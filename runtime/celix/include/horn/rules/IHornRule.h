#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace horn::rules {

enum class Severity : std::int8_t {
    INFO,
    WARNING,
    ERROR,
};

struct HornNodeView {
    std::string id{};
    std::string kind{};
    std::string label{};
    std::string text{};
    bool focus{false};
    std::optional<int> number{};
    std::optional<int> year{};
};

struct HornRelationView {
    std::string id{};
    std::string kind{};
    std::string from{};
    std::string to{};
    std::string label{};
};

struct HornDocumentView {
    std::string id{};
    std::string version{};
    std::string authority{};
    std::string issueQuestion{};
    std::vector<HornNodeView> nodes{};
    std::vector<HornRelationView> relations{};
};

struct RuleMetadata {
    std::string ruleId{};
    std::string profile{};
    std::string displayName{};
    std::string sourceEdition{};
    std::string sourceLocation{};
};

struct Diagnostic {
    std::string ruleId{};
    Severity severity{Severity::INFO};
    std::string targetId{};
    std::string message{};
    std::optional<std::string> suggestion{};
    std::string sourceEdition{};
    std::string sourceLocation{};
};

class IHornRule {
public:
    static constexpr const char* const NAME = "horn::rules::IHornRule";
    static constexpr const char* const VERSION = "1.0.0";

    virtual ~IHornRule() noexcept = default;

    [[nodiscard]] virtual RuleMetadata metadata() const = 0;
    [[nodiscard]] virtual std::vector<Diagnostic> evaluate(const HornDocumentView& document) const = 0;
};

} // namespace horn::rules
