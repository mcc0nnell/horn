#pragma once

#include "horn/RuntimeServices.h"

#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

namespace horn {

struct HornIssue {
    std::string code;
    std::string message;
};

[[nodiscard]] std::vector<HornIssue> validateHornDocumentJson(
    const nlohmann::json& doc);

[[nodiscard]] std::string toValidationReportJson(
    std::string_view documentId,
    std::vector<HornIssue> issues);

[[nodiscard]] std::string validateCanonicalHornDocument(
    std::string_view canonicalHornDocumentJson);

class ValidationService final : public IValidationService {
public:
    [[nodiscard]] std::string validateDocument(
        std::string_view canonicalHornDocumentJson) const override;
};

} // namespace horn
