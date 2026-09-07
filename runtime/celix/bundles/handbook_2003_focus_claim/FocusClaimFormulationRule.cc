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

bool looksLikeFocusKind(const std::string& kind) {
    const auto value = lower(kind);
    return value == "focus-claim" || value == "focus_claim" || value == "focus";
}

bool containsNegativeForm(const std::string& text) {
    const auto value = " " + lower(text) + " ";
    return value.find(" not ") != std::string::npos ||
           value.find(" no ") != std::string::npos ||
           value.find(" cannot ") != std::string::npos ||
           value.find(" can't ") != std::string::npos ||
           value.find(" isn't ") != std::string::npos ||
           value.find(" shouldn't ") != std::string::npos;
}

} // namespace

class FocusClaimFormulationRule final : public IHornRule {
public:
    RuleMetadata metadata() const override {
        return {
            "horn.rules.2003.focus-claim-formulation",
            "horn-2003",
            "Focus-claim formulation",
            "Introduction to Argumentation Mapping (2003)",
            "Chapter 5 — Structuring the First Draft of the Map",
        };
    }

    std::vector<Diagnostic> evaluate(const HornDocumentView& document) const override {
        std::vector<Diagnostic> result{};
        const auto meta = metadata();
        for (const auto& node : document.nodes) {
            if (!looksLikeFocusKind(node.kind)) {
                continue;
            }

            const auto candidate = !node.title.empty() ? node.title : node.text;
            if (candidate.empty()) {
                continue;
            }

            if (!candidate.empty() && candidate.back() == '?') {
                result.push_back(Diagnostic{
                    meta.ruleId,
                    Severity::WARNING,
                    node.id,
                    "The focus claim is phrased as a question rather than as an answer to the argument question.",
                    std::string{"State the focus claim as a direct declarative answer while keeping the argument question separate."},
                    meta.sourceEdition,
                    meta.sourceLocation,
                });
            } else if (containsNegativeForm(candidate)) {
                result.push_back(Diagnostic{
                    meta.ruleId,
                    Severity::INFO,
                    node.id,
                    "The focus claim uses a negative formulation.",
                    std::string{"Check whether an equivalent positive formulation would make later support and dispute easier to read."},
                    meta.sourceEdition,
                    meta.sourceLocation,
                });
            }
        }
        return result;
    }
};

std::shared_ptr<IHornRule> createFocusClaimFormulationRule() {
    return std::make_shared<FocusClaimFormulationRule>();
}

} // namespace horn::rules
