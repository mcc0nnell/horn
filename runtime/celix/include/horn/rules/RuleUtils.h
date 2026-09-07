#pragma once

#include "horn/rules/IHornRule.h"

#include <algorithm>
#include <string_view>

namespace horn::rules {

inline int severityRank(Severity severity) {
    switch (severity) {
        case Severity::ERROR:
            return 0;
        case Severity::WARNING:
            return 1;
        case Severity::INFO:
            return 2;
    }
    return 3;
}

inline void sortDiagnostics(std::vector<Diagnostic>& diagnostics) {
    std::sort(diagnostics.begin(), diagnostics.end(), [](const Diagnostic& lhs, const Diagnostic& rhs) {
        const auto lhsSeverity = severityRank(lhs.severity);
        const auto rhsSeverity = severityRank(rhs.severity);
        if (lhsSeverity != rhsSeverity) {
            return lhsSeverity < rhsSeverity;
        }
        if (lhs.ruleId != rhs.ruleId) {
            return lhs.ruleId < rhs.ruleId;
        }
        if (lhs.targetId != rhs.targetId) {
            return lhs.targetId < rhs.targetId;
        }
        return lhs.message < rhs.message;
    });
}

inline bool containsWord(std::string_view text, std::string_view word) {
    auto pos = text.find(word);
    while (pos != std::string_view::npos) {
        const bool leftOk = pos == 0 || !std::isalnum(static_cast<unsigned char>(text[pos - 1]));
        const auto end = pos + word.size();
        const bool rightOk = end >= text.size() || !std::isalnum(static_cast<unsigned char>(text[end]));
        if (leftOk && rightOk) {
            return true;
        }
        pos = text.find(word, pos + 1);
    }
    return false;
}

} // namespace horn::rules
