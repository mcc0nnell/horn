#include "horn/rules/IHornRule.h"

#include <algorithm>
#include <memory>
#include <string>

namespace horn::rules {

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

            const auto semicolons = static_cast<int>(std::count(node.text.begin(), node.text.end(), ';'));
            const auto periods = static_cast<int>(std::count(node.text.begin(), node.text.end(), '.'));
            const bool enumerated = node.text.find("(1)") != std::string::npos && node.text.find("(2)") != std::string::npos;
            const bool connective = node.text.find(" therefore ") != std::string::npos ||
                                    node.text.find(" because ") != std::string::npos ||
                                    node.text.find(" however ") != std::string::npos;

            if (semicolons >= 2 || periods >= 3 || enumerated || (periods >= 1 && connective)) {
                result.push_back(Diagnostic{
                    meta.ruleId,
                    Severity::WARNING,
                    node.id,
                    "This box may contain more than one independently arguable claim.",
                    std::string{"Consider splitting independently supportable or disputable assertions into separate claim boxes."},
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
