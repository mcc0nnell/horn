#include "horn/rules/IHornRule.h"

#include <memory>
#include <unordered_map>

namespace horn::rules {

class ArgumentReadingDirectionRule final : public IHornRule {
public:
    RuleMetadata metadata() const override {
        return {
            "horn.rules.1998.argument-reading-direction",
            "horn-1998",
            "Argument reading direction",
            "Mapping Great Debates: Can Computers Think? (1998)",
            "Frequently Asked Questions — arrow direction",
        };
    }

    std::vector<Diagnostic> evaluate(const HornDocumentView& document) const override {
        // The 1998 convention is a reading-order convention, not a logical-dependency
        // convention. This rule intentionally refuses to infer logical direction from a
        // support/dispute edge. For the first slice it only detects unresolved endpoints,
        // leaving geometric/read-path verification to the canonical document validator.
        std::unordered_map<std::string, bool> nodes{};
        for (const auto& node : document.nodes) {
            nodes[node.id] = true;
        }

        std::vector<Diagnostic> result{};
        const auto meta = metadata();
        for (const auto& relation : document.relations) {
            if (relation.kind != "supports" && relation.kind != "disputes") {
                continue;
            }
            if (nodes.find(relation.from) == nodes.end() || nodes.find(relation.to) == nodes.end()) {
                result.push_back(Diagnostic{
                    meta.ruleId,
                    Severity::ERROR,
                    relation.id,
                    "A support/dispute relation cannot be interpreted as a 1998 reading thread because an endpoint is unresolved.",
                    std::nullopt,
                    meta.sourceEdition,
                    meta.sourceLocation,
                });
            }
        }
        return result;
    }
};

std::shared_ptr<IHornRule> createArgumentReadingDirectionRule() {
    return std::make_shared<ArgumentReadingDirectionRule>();
}

} // namespace horn::rules
