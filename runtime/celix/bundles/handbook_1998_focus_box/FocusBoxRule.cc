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

} // namespace

class FocusBoxRule final : public IHornRule {
public:
    RuleMetadata metadata() const override {
        return {
            "horn.rules.1998.focus-box",
            "horn-1998",
            "Focus-box presence",
            "Mapping Great Debates: Can Computers Think? (1998)",
            "Map legend / focus-box convention",
        };
    }

    std::vector<Diagnostic> evaluate(const HornDocumentView& document) const override {
        const auto meta = metadata();
        const auto count = static_cast<std::size_t>(std::count_if(document.nodes.begin(), document.nodes.end(), [](const HornNodeView& node) {
            return looksLikeFocusKind(node.kind);
        }));

        if (count > 0 || document.nodes.empty()) {
            return {};
        }

        return {Diagnostic{
            meta.ruleId,
            Severity::INFO,
            document.id,
            "No node in this document is explicitly identified as a focus claim.",
            std::string{"If this document models a 1998-style issue area, verify that its introductory focus box is represented explicitly."},
            meta.sourceEdition,
            meta.sourceLocation,
        }};
    }
};

std::shared_ptr<IHornRule> createFocusBoxRule() {
    return std::make_shared<FocusBoxRule>();
}

} // namespace horn::rules
