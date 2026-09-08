#include "horn/TraversalRuntime.h"

#include <cassert>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

namespace {

using json = nlohmann::json;

const char* ARGUMENT = R"json({
  "id":"demo",
  "version":"horn-argument/0.1",
  "title":"Demo",
  "issueQuestion":"Does the engine traverse arguments?",
  "issueType":"fact",
  "sources":[],
  "claims":[
    {"id":"position","role":"position","statement":"Yes","sourceIds":[]},
    {"id":"grounds","role":"grounds","statement":"There is evidence","sourceIds":[]},
    {"id":"rebuttal","role":"rebuttal","statement":"Not yet","sourceIds":[]}
  ],
  "relations":[
    {"id":"support","kind":"supports","from":"grounds","to":"position"},
    {"id":"dispute","kind":"disputes","from":"rebuttal","to":"position"}
  ],
  "focusClaimId":"position",
  "streams":[
    {"id":"support-stream","focusClaimId":"position","claimIds":["position","grounds"]}
  ]
})json";

std::string operation(const char* kind, const char* key = nullptr, const char* value = nullptr) {
    json op{
        {"version", "horn-runtime-operation/0.1"},
        {"kind", kind},
    };
    if (key && value) op[key] = value;
    return op.dump();
}

} // namespace

int main() {
    horn::TraversalRuntime runtime{};

    const auto initial = json::parse(runtime.initialState(ARGUMENT));
    assert(initial.at("currentClaimId") == "position");
    assert(initial.at("step") == 0);

    const auto firstEnvelope = json::parse(runtime.transition(
        ARGUMENT,
        initial.dump(),
        operation("follow-relation", "relationId", "support")));
    const auto firstState = firstEnvelope.at("state");
    const auto firstReceipt = firstEnvelope.at("receipt");
    assert(firstState.at("currentClaimId") == "grounds");
    assert(firstState.at("step") == 1);
    assert(firstReceipt.at("effect").at("relationDirection") == "semantic-reverse");

    const auto secondEnvelope = json::parse(runtime.transition(
        ARGUMENT,
        firstState.dump(),
        operation("follow-relation", "relationId", "support"),
        firstReceipt.dump()));
    const auto secondReceipt = secondEnvelope.at("receipt");
    assert(secondEnvelope.at("state").at("currentClaimId") == "position");
    assert(secondReceipt.at("previousReceiptId") == firstReceipt.at("id"));

    const auto streamEnvelope = json::parse(runtime.transition(
        ARGUMENT,
        secondEnvelope.at("state").dump(),
        operation("enter-stream", "streamId", "support-stream"),
        secondReceipt.dump()));

    bool blocked = false;
    try {
        (void)runtime.transition(
            ARGUMENT,
            streamEnvelope.at("state").dump(),
            operation("enter-claim", "claimId", "rebuttal"),
            streamEnvelope.at("receipt").dump());
    } catch (const std::invalid_argument&) {
        blocked = true;
    }
    assert(blocked);

    auto tamperedReceipt = firstReceipt;
    tamperedReceipt["targetStateHash"] = "tampered";
    bool rejectedTamper = false;
    try {
        (void)runtime.transition(
            ARGUMENT,
            firstState.dump(),
            operation("focus-issue"),
            tamperedReceipt.dump());
    } catch (const std::invalid_argument&) {
        rejectedTamper = true;
    }
    assert(rejectedTamper);

    return 0;
}
