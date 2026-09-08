#include "ProofService.h"

#include "QueryService.h"
#include "Sha256.h"

#include <algorithm>
#include <set>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

namespace horn {
namespace {

using json = nlohmann::json;

std::string canonicalJson(const json& value) {
    // nlohmann::json's default object storage is key-ordered. For Horn's
    // JSON-compatible contract values this matches the TypeScript recursive
    // key-sort canonicalization used by horn-proof/0.1.
    return value.dump();
}

std::string canonicalSha256(const json& value) {
    return detail::sha256Hex(canonicalJson(value));
}

std::set<std::string> stringSet(const json& value) {
    std::set<std::string> out;
    if (!value.is_array()) {
        return out;
    }
    for (const auto& entry : value) {
        if (entry.is_string()) {
            out.insert(entry.get<std::string>());
        }
    }
    return out;
}

json deriveDependencies(const json& document, const json& request) {
    std::set<std::string> relationKinds{
        "supports",
        "disputes",
        "interprets-as",
    };
    if (request.contains("relationKinds")) {
        relationKinds = stringSet(request.at("relationKinds"));
    }

    std::set<std::string> relationIds;
    std::set<std::string> nodeIds;

    if (request.contains("focusNodeId") && request.at("focusNodeId").is_string()) {
        nodeIds.insert(request.at("focusNodeId").get<std::string>());
    }
    if (request.contains("targetNodeId") && request.at("targetNodeId").is_string()) {
        nodeIds.insert(request.at("targetNodeId").get<std::string>());
    }

    if (request.contains("suppress") && request.at("suppress").is_object()) {
        const auto& suppress = request.at("suppress");
        if (suppress.contains("nodeIds")) {
            const auto suppressedNodes = stringSet(suppress.at("nodeIds"));
            nodeIds.insert(suppressedNodes.begin(), suppressedNodes.end());
        }
        if (suppress.contains("relationIds")) {
            relationIds = stringSet(suppress.at("relationIds"));
        }
    }

    std::vector<json> relations;
    if (document.contains("relations") && document.at("relations").is_array()) {
        for (const auto& relation : document.at("relations")) {
            if (!relation.is_object() ||
                !relation.contains("id") || !relation.at("id").is_string() ||
                !relation.contains("kind") || !relation.at("kind").is_string() ||
                !relation.contains("from") || !relation.at("from").is_string() ||
                !relation.contains("to") || !relation.at("to").is_string()) {
                continue;
            }

            const auto id = relation.at("id").get<std::string>();
            const auto kind = relation.at("kind").get<std::string>();
            if (relationKinds.count(kind) == 0U && relationIds.count(id) == 0U) {
                continue;
            }

            const auto from = relation.at("from").get<std::string>();
            const auto to = relation.at("to").get<std::string>();
            nodeIds.insert(from);
            nodeIds.insert(to);
            relations.push_back({
                {"id", id},
                {"kind", kind},
                {"from", from},
                {"to", to},
            });
        }
    }

    std::sort(relations.begin(), relations.end(), [](const json& left, const json& right) {
        return left.at("id").get<std::string>() < right.at("id").get<std::string>();
    });

    std::vector<json> nodes;
    if (document.contains("nodes") && document.at("nodes").is_array()) {
        for (const auto& node : document.at("nodes")) {
            if (!node.is_object() ||
                !node.contains("id") || !node.at("id").is_string() ||
                !node.contains("number") || !node.at("number").is_number_integer()) {
                continue;
            }
            const auto id = node.at("id").get<std::string>();
            if (nodeIds.count(id) == 0U) {
                continue;
            }
            nodes.push_back({
                {"id", id},
                {"number", node.at("number")},
            });
        }
    }

    std::sort(nodes.begin(), nodes.end(), [](const json& left, const json& right) {
        const auto leftNumber = left.at("number").get<long long>();
        const auto rightNumber = right.at("number").get<long long>();
        if (leftNumber != rightNumber) {
            return leftNumber < rightNumber;
        }
        return left.at("id").get<std::string>() < right.at("id").get<std::string>();
    });

    json core = {
        {"version", "horn-query-dependencies/0.1"},
        {"nodeFields", json::array({"id", "number"})},
        {"relationFields", json::array({"id", "kind", "from", "to"})},
        {"nodes", nodes},
        {"relations", relations},
    };

    json dependencies = core;
    dependencies["canonicalSha256"] = canonicalSha256(core);
    return dependencies;
}

json createProofValue(const json& document, const json& request) {
    QueryService queryService;
    const auto resultText = queryService.queryDocument(document.dump(), request.dump());
    const auto result = json::parse(resultText);
    const auto dependencies = deriveDependencies(document, request);

    json core = {
        {"version", "horn-proof/0.1"},
        {"algorithm", "horn-query-replay/0.1"},
        {"source", {
            {"documentId", document.at("id")},
            {"documentVersion", document.at("version")},
            {"canonicalSha256", canonicalSha256(document)},
        }},
        {"request", request},
        {"result", result},
        {"dependencies", dependencies},
    };

    json proof = core;
    proof["id"] = std::string{"horn-proof:"} + canonicalSha256(core);
    return proof;
}

void addIssue(std::vector<json>& issues, std::string code, std::string message) {
    issues.push_back({
        {"code", std::move(code)},
        {"message", std::move(message)},
    });
}

bool isStringEqual(const json& object, const char* key, const json& expected) {
    return object.contains(key) && object.at(key).is_string() && expected.is_string() &&
           object.at(key).get<std::string>() == expected.get<std::string>();
}

void comparePart(
    std::vector<json>& issues,
    std::string code,
    std::string message,
    const json& expected,
    const json& actual) {
    if (canonicalJson(expected) != canonicalJson(actual)) {
        addIssue(issues, std::move(code), std::move(message));
    }
}

json verificationValue(const json& document, const json& proof) {
    std::vector<json> issues;
    json proofId = nullptr;
    if (proof.is_object() && proof.contains("id") && proof.at("id").is_string()) {
        proofId = proof.at("id");
    }

    if (!proof.is_object()) {
        return {
            {"version", "horn-proof-verification/0.1"},
            {"proofId", proofId},
            {"sourceDocumentId", document.at("id")},
            {"ok", false},
            {"issues", json::array({{
                {"code", "invalid-proof"},
                {"message", "Horn proof must be an object"},
            }})},
        };
    }

    if (!proof.contains("version") || !proof.at("version").is_string() ||
        proof.at("version") != "horn-proof/0.1") {
        addIssue(issues, "version", "unsupported Horn proof version");
    }
    if (!proof.contains("algorithm") || !proof.at("algorithm").is_string() ||
        proof.at("algorithm") != "horn-query-replay/0.1") {
        addIssue(issues, "algorithm", "unsupported Horn proof algorithm");
    }
    if (!proof.contains("source") || !proof.at("source").is_object()) {
        addIssue(issues, "invalid-source", "Horn proof needs source metadata");
    }
    if (!proof.contains("request") || !proof.at("request").is_object()) {
        addIssue(issues, "invalid-request", "Horn proof needs a query request");
    }
    if (!proof.contains("result") || !proof.at("result").is_object()) {
        addIssue(issues, "invalid-result", "Horn proof needs a query result");
    }
    if (!proof.contains("dependencies") || !proof.at("dependencies").is_object()) {
        addIssue(issues, "invalid-dependencies", "Horn proof needs a dependency witness");
    }

    if (issues.empty()) {
        try {
            const auto expected = createProofValue(document, proof.at("request"));
            const auto& source = proof.at("source");
            const auto& dependencies = proof.at("dependencies");

            if (!isStringEqual(source, "documentId", document.at("id")) ||
                !isStringEqual(source, "documentVersion", document.at("version"))) {
                addIssue(
                    issues,
                    "source-identity-mismatch",
                    "proof source identity does not match the supplied Horn document");
            }

            if (!isStringEqual(source, "canonicalSha256", expected.at("source").at("canonicalSha256"))) {
                addIssue(
                    issues,
                    "source-digest-mismatch",
                    "canonical Horn document digest does not match the proof");
            }

            if (!isStringEqual(
                    dependencies,
                    "canonicalSha256",
                    expected.at("dependencies").at("canonicalSha256"))) {
                addIssue(
                    issues,
                    "dependency-digest-mismatch",
                    "query dependency witness digest does not match");
            }

            comparePart(
                issues,
                "dependency-witness-mismatch",
                "query dependency witness does not replay exactly",
                expected.at("dependencies"),
                proof.at("dependencies"));

            comparePart(
                issues,
                "result-mismatch",
                "query result does not replay exactly",
                expected.at("result"),
                proof.at("result"));

            if (!proofId.is_string() || proofId != expected.at("id")) {
                addIssue(
                    issues,
                    "proof-id-mismatch",
                    "content-addressed proof id does not match the replayed proof");
            }
        } catch (const std::exception& error) {
            addIssue(issues, "replay-failed", error.what());
        } catch (...) {
            addIssue(issues, "replay-failed", "Horn proof replay failed");
        }
    }

    std::sort(issues.begin(), issues.end(), [](const json& left, const json& right) {
        const auto leftCode = left.at("code").get<std::string>();
        const auto rightCode = right.at("code").get<std::string>();
        if (leftCode != rightCode) {
            return leftCode < rightCode;
        }
        return left.at("message").get<std::string>() < right.at("message").get<std::string>();
    });

    return {
        {"version", "horn-proof-verification/0.1"},
        {"proofId", proofId},
        {"sourceDocumentId", document.at("id")},
        {"ok", issues.empty()},
        {"issues", issues},
    };
}

} // namespace

std::string ProofService::createProof(
    std::string_view canonicalHornDocumentJson,
    std::string_view hornQueryRequestJson) const {
    const auto document = json::parse(canonicalHornDocumentJson);
    const auto request = json::parse(hornQueryRequestJson);
    return createProofValue(document, request).dump();
}

std::string ProofService::verifyProof(
    std::string_view canonicalHornDocumentJson,
    std::string_view hornProofJson) const {
    const auto document = json::parse(canonicalHornDocumentJson);
    const auto proof = json::parse(hornProofJson);
    return verificationValue(document, proof).dump();
}

} // namespace horn
