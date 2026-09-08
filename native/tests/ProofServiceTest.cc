#include "ProofService.h"
#include "Sha256.h"

#include <cassert>
#include <string>

#include <nlohmann/json.hpp>

namespace {

constexpr const char* DOCUMENT = R"json({
  "id":"horn:test:native-proof",
  "version":"horn-document/0.1",
  "vocabulary":["argumentation"],
  "unitSize":"concept-diagram",
  "authority":"authored",
  "after":{"name":"Robert E. Horn","works":["Mapping Great Debates"]},
  "title":"Native proof fixture",
  "subtitle":"",
  "issueQuestion":"Does native proof replay?",
  "canvas":{"width":600,"height":300,"unit":"test","origin":"top-left"},
  "regions":[],
  "nodes":[
    {"id":"focus","number":1,"kind":"focus-claim","origin":"authored","focus":true,"label":"focus","text":"focus","geometry":{"x":20,"y":20,"w":100,"h":50},"citationIds":["cartographic"]},
    {"id":"reply","number":2,"kind":"claim","origin":"authored","label":"reply","text":"reply","geometry":{"x":180,"y":20,"w":100,"h":50},"citationIds":["cartographic"]}
  ],
  "relations":[{"id":"reply-focus","kind":"supports","from":"reply","to":"focus","label":"supports"}],
  "citations":[{"id":"cartographic","layer":"cartographic","citation":"test","short":"test","year":2026}],
  "readingPath":["focus","reply"],
  "rights":"test fixture"
})json";

constexpr const char* REQUEST = R"json({
  "version":"horn-query-request/0.1",
  "operation":"graph",
  "focusNodeId":"focus"
})json";

} // namespace

int main() {
    using nlohmann::json;

    assert(
        horn::detail::sha256Hex("abc") ==
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

    horn::ProofService service;
    const auto proof = json::parse(service.createProof(DOCUMENT, REQUEST));

    assert(proof.at("version") == "horn-proof/0.1");
    assert(proof.at("algorithm") == "horn-query-replay/0.1");
    assert(proof.at("id").is_string());
    assert(proof.at("id").get<std::string>().rfind("horn-proof:", 0) == 0);
    assert(proof.at("dependencies").at("canonicalSha256").is_string());

    const auto verification = json::parse(service.verifyProof(DOCUMENT, proof.dump()));
    assert(verification.at("ok") == true);
    assert(verification.at("issues").empty());

    auto tampered = proof;
    tampered["result"]["result"]["frontierNodeIds"] = json::array();
    const auto rejected = json::parse(service.verifyProof(DOCUMENT, tampered.dump()));
    assert(rejected.at("ok") == false);

    bool sawResultMismatch = false;
    bool sawProofIdMismatch = false;
    for (const auto& issue : rejected.at("issues")) {
        sawResultMismatch = sawResultMismatch || issue.at("code") == "result-mismatch";
        sawProofIdMismatch = sawProofIdMismatch || issue.at("code") == "proof-id-mismatch";
    }
    assert(sawResultMismatch);
    assert(!sawProofIdMismatch);

    auto wrongId = proof;
    wrongId["id"] = "horn-proof:0000000000000000000000000000000000000000000000000000000000000000";
    const auto idRejected = json::parse(service.verifyProof(DOCUMENT, wrongId.dump()));
    assert(idRejected.at("ok") == false);
    bool sawExplicitIdMismatch = false;
    for (const auto& issue : idRejected.at("issues")) {
        sawExplicitIdMismatch = sawExplicitIdMismatch || issue.at("code") == "proof-id-mismatch";
    }
    assert(sawExplicitIdMismatch);

    return 0;
}
