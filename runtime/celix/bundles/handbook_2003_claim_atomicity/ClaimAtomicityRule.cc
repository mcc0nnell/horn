#include "horn/rules/IHornRule.h"

#include <algorithm>
#include <cctype>
#include <memory>
#include <string>

namespace horn::rules {
namespace {

std::string lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return value;
}

bool hasArgumentMoveMarker(const std::string& text) {
    const auto value = " " + lower(text) + " ";
    return value.find(" because ") != std::string::npos ||
           value.find(" therefore ") != std::string::npos ||
           value.find(" for example ") != std::string::npos;
}

bool hasEnumeratedMoves(const std::string& text) {
    return (text.find("(1)") != std::string::npos && text.find("(2)") != std::string::npos) ||
           (text.find("1.") != std::string::npos && text.find("2.") != std::string::npos);
}

} // namespace

class ClaimAtomicityRule final : public IHornRule {
public:
    RuleMetadata metadata() const override {
        return {
            "horn.rules.2003.claim-atomicity",
            "horn-2003",
            "Claim atomicity",
            "Introduction to Argumentation Mapping (2003)",
            "Chapter 6 — Writing Claims",
        };
    }

    std::vector<Diagnostic> evaluate(const HornDocumentView& document) const override {
        std::vector<Diagnostic> result{};
        const auto meta = metadata();
        for (const auto& node : document.nodes) {
            if (node.text.empty()) {
                continue;
            }

            // Horn explicitly allows a claim box to contain several explanatory sentences.
            // Sentence count alone is therefore not evidence of a multi-claim box. The
            // conservative first slice only warns on source-grounded indicators of another
            // argumentative move inside the same box.
            if (hasArgumentMoveMarker(node.text) || hasEnumeratedMoves(node.text)) {
                result.push_back(Diagnostic{
                    meta.ruleId,
                    Severity::WARNING,
                    node.id,
                    "This box contains a marker that may introduce a second argumentative move.",
                    std::string{"Verify that the box contains one claim; split a separately supportable or disputable move into its own box."},
                    meta.sourceEdition,
                    meta.sourceLocation,
                });
            }
        }
        return result;
    }
};

std::shared_ptr<IHornRule> createClaimAtomicityRule() {
    return std::make_shared<ClaimAtomicityRule>();
}

} // namespace horn::rules
