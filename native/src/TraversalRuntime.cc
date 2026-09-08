#include "horn/TraversalRuntime.h"

#include "Sha256.h"
#include "horn/EngineServices.h"

#include <algorithm>
#include <cstdint>
#include <optional>
#include <limits>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

namespace horn {
namespace {

using json = nlohmann::json;

struct Relation {
    std::string id;
    std::string kind;
    std::string from;
    std::string to;
};

struct Stream {
    std::string id;
    std::string focusClaimId;
    std::unordered_set<std::string> claimIds;
};

struct ArgumentIndex {
    std::string id;
    std::string focusClaimId;
    std::unordered_set<std::string> claimIds;
    std::unordered_map<std::string, Relation> relations;
    std::unordered_map<std::string, Stream> streams;
};

[[noreturn]] void fail(std::string message) {
    throw std::invalid_argument{std::move(message)};
}

const json& requireObjectMember(const json& object, std::string_view key) {
    const auto it = object.find(std::string{key});
    if (it == object.end()) {
        fail("missing required member: " + std::string{key});
    }
    return *it;
}

std::string requireString(const json& object, std::string_view key) {
    const auto& value = requireObjectMember(object, key);
    if (!value.is_string() || value.get_ref<const std::string&>().empty()) {
        fail("member must be a non-empty string: " + std::string{key});
    }
    return value.get<std::string>();
}

const json& requireArray(const json& object, std::string_view key) {
    const auto& value = requireObjectMember(object, key);
    if (!value.is_array()) {
        fail("member must be an array: " + std::string{key});
    }
    return value;
}

json parseObject(std::string_view serialized, std::string_view label) {
    json value;
    try {
        value = json::parse(serialized.begin(), serialized.end());
    } catch (const json::parse_error& error) {
        fail(std::string{label} + " is not valid JSON: " + error.what());
    }
    if (!value.is_object()) {
        fail(std::string{label} + " must be a JSON object");
    }
    return value;
}

ArgumentIndex indexArgument(std::string_view serialized) {
    const auto argument = parseObject(serialized, "Horn argument");
    if (requireString(argument, "version") != ARGUMENT_CONTRACT) {
        fail("unsupported Horn argument contract");
    }

    ArgumentIndex index{
        requireString(argument, "id"),
        requireString(argument, "focusClaimId"),
        {},
        {},
        {},
    };

    for (const auto& claim : requireArray(argument, "claims")) {
        if (!claim.is_object()) fail("claims entries must be objects");
        const auto id = requireString(claim, "id");
        if (!index.claimIds.emplace(id).second) {
            fail("duplicate claim id: " + id);
        }
    }
    if (index.claimIds.find(index.focusClaimId) == index.claimIds.end()) {
        fail("focus claim does not exist: " + index.focusClaimId);
    }

    for (const auto& relationJson : requireArray(argument, "relations")) {
        if (!relationJson.is_object()) fail("relations entries must be objects");
        Relation relation{
            requireString(relationJson, "id"),
            requireString(relationJson, "kind"),
            requireString(relationJson, "from"),
            requireString(relationJson, "to"),
        };
        if (relation.kind != "supports" && relation.kind != "disputes" && relation.kind != "backs") {
            fail("unsupported relation kind: " + relation.kind);
        }
        if (relation.from == relation.to) {
            fail("relation cannot relate a claim to itself: " + relation.id);
        }
        if (index.claimIds.find(relation.from) == index.claimIds.end()) {
            fail("relation references unknown from claim: " + relation.id);
        }
        if (index.claimIds.find(relation.to) == index.claimIds.end()) {
            fail("relation references unknown to claim: " + relation.id);
        }
        if (!index.relations.emplace(relation.id, relation).second) {
            fail("duplicate relation id: " + relation.id);
        }
    }

    for (const auto& streamJson : requireArray(argument, "streams")) {
        if (!streamJson.is_object()) fail("streams entries must be objects");
        Stream stream{
            requireString(streamJson, "id"),
            requireString(streamJson, "focusClaimId"),
            {},
        };
        if (index.claimIds.find(stream.focusClaimId) == index.claimIds.end()) {
            fail("stream references unknown focus claim: " + stream.id);
        }
        for (const auto& claimIdJson : requireArray(streamJson, "claimIds")) {
            if (!claimIdJson.is_string()) fail("stream claimIds must contain strings");
            const auto claimId = claimIdJson.get<std::string>();
            if (index.claimIds.find(claimId) == index.claimIds.end()) {
                fail("stream references unknown claim: " + stream.id + " -> " + claimId);
            }
            stream.claimIds.emplace(claimId);
        }
        if (stream.claimIds.find(stream.focusClaimId) == stream.claimIds.end()) {
            fail("stream focus claim is outside stream: " + stream.id);
        }
        if (!index.streams.emplace(stream.id, std::move(stream)).second) {
            fail("duplicate stream id: " + requireString(streamJson, "id"));
        }
    }

    return index;
}

std::string stateHash(const json& state) {
    return detail::sha256Hex(state.dump());
}

json canonicalState(const ArgumentIndex& argument, json state) {
    if (requireString(state, "version") != RUNTIME_STATE_CONTRACT) {
        fail("unsupported Horn runtime state contract");
    }
    if (requireString(state, "argumentId") != argument.id) {
        fail("runtime state belongs to a different Horn argument");
    }

    const auto currentClaimId = requireString(state, "currentClaimId");
    if (argument.claimIds.find(currentClaimId) == argument.claimIds.end()) {
        fail("runtime state references unknown current claim: " + currentClaimId);
    }

    const auto& stepJson = requireObjectMember(state, "step");
    std::uint64_t step = 0U;
    if (stepJson.is_number_unsigned()) {
        step = stepJson.get<std::uint64_t>();
    } else if (stepJson.is_number_integer()) {
        const auto signedStep = stepJson.get<std::int64_t>();
        if (signedStep < 0) fail("runtime state step must be non-negative");
        step = static_cast<std::uint64_t>(signedStep);
    } else {
        fail("runtime state step must be a non-negative integer");
    }

    std::optional<std::string> activeStreamId;
    if (const auto it = state.find("activeStreamId"); it != state.end()) {
        if (!it->is_string()) fail("activeStreamId must be a string");
        activeStreamId = it->get<std::string>();
        const auto streamIt = argument.streams.find(*activeStreamId);
        if (streamIt == argument.streams.end()) {
            fail("runtime state references unknown active stream: " + *activeStreamId);
        }
        if (streamIt->second.claimIds.find(currentClaimId) == streamIt->second.claimIds.end()) {
            fail("current claim is outside active stream");
        }
    }

    const auto& visitedJson = requireArray(state, "visitedClaimIds");
    std::vector<std::string> visited;
    std::unordered_set<std::string> seen;
    for (const auto& claimIdJson : visitedJson) {
        if (!claimIdJson.is_string()) fail("visitedClaimIds must contain strings");
        const auto claimId = claimIdJson.get<std::string>();
        if (argument.claimIds.find(claimId) == argument.claimIds.end()) {
            fail("runtime state references unknown visited claim: " + claimId);
        }
        if (seen.emplace(claimId).second) {
            visited.push_back(claimId);
        }
    }
    if (seen.find(currentClaimId) == seen.end()) {
        visited.push_back(currentClaimId);
    }
    std::sort(visited.begin(), visited.end());

    json canonical{
        {"version", std::string{RUNTIME_STATE_CONTRACT}},
        {"argumentId", argument.id},
        {"currentClaimId", currentClaimId},
        {"step", step},
        {"visitedClaimIds", visited},
    };
    if (activeStreamId) {
        canonical["activeStreamId"] = *activeStreamId;
    }
    return canonical;
}

bool streamAllowsClaim(
    const ArgumentIndex& argument,
    const json& state,
    const std::string& claimId) {
    const auto it = state.find("activeStreamId");
    if (it == state.end()) return true;
    const auto streamIt = argument.streams.find(it->get<std::string>());
    return streamIt != argument.streams.end() &&
           streamIt->second.claimIds.find(claimId) != streamIt->second.claimIds.end();
}

void markVisited(json& state, const std::string& claimId) {
    auto visited = state.at("visitedClaimIds").get<std::vector<std::string>>();
    if (std::find(visited.begin(), visited.end(), claimId) == visited.end()) {
        visited.push_back(claimId);
        std::sort(visited.begin(), visited.end());
        state["visitedClaimIds"] = visited;
    }
}

struct AppliedOperation {
    json canonicalOperation;
    json effect;
};

AppliedOperation applyOperation(
    const ArgumentIndex& argument,
    json& state,
    std::string_view serializedOperation) {
    const auto operation = parseObject(serializedOperation, "Horn runtime operation");
    if (requireString(operation, "version") != RUNTIME_OPERATION_CONTRACT) {
        fail("unsupported Horn runtime operation contract");
    }
    const auto kind = requireString(operation, "kind");
    const auto fromClaimId = state.at("currentClaimId").get<std::string>();

    json canonicalOperation{
        {"version", std::string{RUNTIME_OPERATION_CONTRACT}},
        {"kind", kind},
    };
    json effect{
        {"kind", "move-focus"},
        {"fromClaimId", fromClaimId},
    };

    if (kind == "enter-claim") {
        const auto claimId = requireString(operation, "claimId");
        if (argument.claimIds.find(claimId) == argument.claimIds.end()) {
            fail("enter-claim references unknown claim: " + claimId);
        }
        if (!streamAllowsClaim(argument, state, claimId)) {
            fail("enter-claim target is outside active stream: " + claimId);
        }
        canonicalOperation["claimId"] = claimId;
        state["currentClaimId"] = claimId;
        effect["toClaimId"] = claimId;
        effect["mode"] = "direct";
        markVisited(state, claimId);
    } else if (kind == "follow-relation") {
        const auto relationId = requireString(operation, "relationId");
        const auto relationIt = argument.relations.find(relationId);
        if (relationIt == argument.relations.end()) {
            fail("follow-relation references unknown relation: " + relationId);
        }
        const auto& relation = relationIt->second;
        std::string toClaimId;
        std::string direction;
        if (relation.from == fromClaimId) {
            toClaimId = relation.to;
            direction = "semantic-forward";
        } else if (relation.to == fromClaimId) {
            toClaimId = relation.from;
            direction = "semantic-reverse";
        } else {
            fail("relation is not adjacent to current claim: " + relationId);
        }
        if (!streamAllowsClaim(argument, state, toClaimId)) {
            fail("follow-relation target is outside active stream: " + toClaimId);
        }
        canonicalOperation["relationId"] = relationId;
        state["currentClaimId"] = toClaimId;
        effect["toClaimId"] = toClaimId;
        effect["mode"] = "relation";
        effect["relationId"] = relationId;
        effect["relationKind"] = relation.kind;
        effect["relationDirection"] = direction;
        markVisited(state, toClaimId);
    } else if (kind == "enter-stream") {
        const auto streamId = requireString(operation, "streamId");
        const auto streamIt = argument.streams.find(streamId);
        if (streamIt == argument.streams.end()) {
            fail("enter-stream references unknown stream: " + streamId);
        }
        canonicalOperation["streamId"] = streamId;
        state["activeStreamId"] = streamId;
        state["currentClaimId"] = streamIt->second.focusClaimId;
        effect["toClaimId"] = streamIt->second.focusClaimId;
        effect["mode"] = "stream-focus";
        effect["streamId"] = streamId;
        markVisited(state, streamIt->second.focusClaimId);
    } else if (kind == "leave-stream") {
        canonicalOperation = {
            {"version", std::string{RUNTIME_OPERATION_CONTRACT}},
            {"kind", "leave-stream"},
        };
        if (const auto it = state.find("activeStreamId"); it != state.end()) {
            effect["streamId"] = *it;
        }
        state.erase("activeStreamId");
        effect["toClaimId"] = fromClaimId;
        effect["mode"] = "leave-stream";
    } else if (kind == "focus-issue") {
        canonicalOperation = {
            {"version", std::string{RUNTIME_OPERATION_CONTRACT}},
            {"kind", "focus-issue"},
        };
        state.erase("activeStreamId");
        state["currentClaimId"] = argument.focusClaimId;
        effect["toClaimId"] = argument.focusClaimId;
        effect["mode"] = "issue-focus";
        markVisited(state, argument.focusClaimId);
    } else {
        fail("unsupported Horn runtime operation kind: " + kind);
    }

    const auto step = state.at("step").get<std::uint64_t>();
    if (step == std::numeric_limits<std::uint64_t>::max()) {
        fail("runtime state step overflow");
    }
    state["step"] = step + 1U;
    return {std::move(canonicalOperation), std::move(effect)};
}

std::optional<std::string> verifyPreviousReceipt(
    std::string_view serialized,
    const ArgumentIndex& argument,
    std::string_view sourceHash) {
    if (serialized.empty()) return std::nullopt;

    auto receipt = parseObject(serialized, "previous Horn transition receipt");
    if (requireString(receipt, "version") != TRANSITION_RECEIPT_CONTRACT) {
        fail("unsupported previous Horn transition receipt contract");
    }
    if (requireString(receipt, "argumentId") != argument.id) {
        fail("previous receipt belongs to a different Horn argument");
    }
    if (requireString(receipt, "targetStateHash") != sourceHash) {
        fail("previous receipt does not terminate at the supplied runtime state");
    }

    const auto suppliedId = requireString(receipt, "id");
    receipt.erase("id");
    const auto expectedId = detail::sha256Hex(receipt.dump());
    if (suppliedId != expectedId) {
        fail("previous receipt digest is invalid");
    }
    return suppliedId;
}

} // namespace

std::string TraversalRuntime::initialState(
    std::string_view canonicalHornArgumentJson) const {
    const auto argument = indexArgument(canonicalHornArgumentJson);
    const json state{
        {"version", std::string{RUNTIME_STATE_CONTRACT}},
        {"argumentId", argument.id},
        {"currentClaimId", argument.focusClaimId},
        {"step", 0U},
        {"visitedClaimIds", json::array({argument.focusClaimId})},
    };
    return state.dump();
}

std::string TraversalRuntime::transition(
    std::string_view canonicalHornArgumentJson,
    std::string_view runtimeStateJson,
    std::string_view operationJson,
    std::string_view previousReceiptJson) const {
    const auto argument = indexArgument(canonicalHornArgumentJson);
    auto sourceState = canonicalState(argument, parseObject(runtimeStateJson, "Horn runtime state"));
    const auto sourceStateHash = stateHash(sourceState);
    const auto previousReceiptId =
        verifyPreviousReceipt(previousReceiptJson, argument, sourceStateHash);

    auto targetState = sourceState;
    const auto applied = applyOperation(argument, targetState, operationJson);
    targetState = canonicalState(argument, std::move(targetState));
    const auto targetStateHash = stateHash(targetState);

    json receiptBody{
        {"version", std::string{TRANSITION_RECEIPT_CONTRACT}},
        {"argumentId", argument.id},
        {"operation", applied.canonicalOperation},
        {"effect", applied.effect},
        {"sourceStateHash", sourceStateHash},
        {"targetStateHash", targetStateHash},
    };
    if (previousReceiptId) {
        receiptBody["previousReceiptId"] = *previousReceiptId;
    }

    const auto receiptId = detail::sha256Hex(receiptBody.dump());
    json receipt = receiptBody;
    receipt["id"] = receiptId;

    const json envelope{
        {"version", std::string{RUNTIME_TRANSITION_CONTRACT}},
        {"state", targetState},
        {"receipt", receipt},
    };
    return envelope.dump();
}

} // namespace horn
