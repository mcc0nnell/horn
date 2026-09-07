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

} // namespace

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
        // Horn's 1998 arrows direct the eye through the conversation. The wording on
        // those roads is therefore deliberately "supported by" / "disputed by" rather
        // than a logical-dependency label pointed in the opposite direction. This rule
        // checks the authored reading label only; it never reverses endpoints or geometry.
        std::vector<Diagnostic> result{};
        const auto meta = metadata();
        for (const auto& relation : document.relations) {
            std::string expected{};
            if (relation.kind == "supports") {
                expected = "supported by";
            } else if (relation.kind == "disputes") {
                expected = "disputed by";
            } else {
                continue;
            }

            if (lower(relation.label) != expected) {
                result.push_back(Diagnostic{
                    meta.ruleId,
                    Severity::WARNING,
                    relation.id,
                    "The support/dispute road does not use the 1998 forward-reading label '" + expected + "'.",
                    std::string{"Preserve the authored road geometry and verify the human-facing reading label; do not reverse the relation automatically."},
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
