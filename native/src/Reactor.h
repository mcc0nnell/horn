#pragma once

#include "horn/RuntimeServices.h"

#include <nlohmann/json.hpp>

#include <string>
#include <string_view>
#include <vector>

namespace horn {

[[nodiscard]] ProjectionView parseProjectionView(std::string_view name);

[[nodiscard]] nlohmann::json projectAnalyticalViewJson(
    const nlohmann::json& document,
    ProjectionView view);

[[nodiscard]] std::string projectAnalyticalViewText(
    std::string_view canonicalHornDocumentJson,
    ProjectionView view);

[[nodiscard]] std::string queryDocumentText(
    std::string_view canonicalHornDocumentJson,
    std::string_view queryRequestJson);

[[nodiscard]] std::string explainIdentityText(
    std::string_view canonicalHornDocumentJson,
    std::string_view identity,
    std::string_view supportingArtifactsJson);

[[nodiscard]] std::string assessImpactText(
    std::string_view canonicalHornDocumentJson,
    std::string_view evidenceSnapshotJson,
    std::string_view bindingsJson);

[[nodiscard]] std::string diffDocumentsText(
    std::string_view beforeHornDocumentJson,
    std::string_view afterHornDocumentJson);

[[nodiscard]] std::string inspectDocumentText(
    std::string_view canonicalHornDocumentJson,
    std::string_view requestJson);

class ProjectionService final : public IProjectionService {
public:
    [[nodiscard]] std::string projectDocument(
        std::string_view canonicalHornDocumentJson,
        ProjectionView view) const override;
};

class QueryService final : public IQueryService {
public:
    [[nodiscard]] std::string query(
        std::string_view canonicalHornDocumentJson,
        std::string_view queryRequestJson) const override;
};

class ExplanationService final : public IExplanationService {
public:
    [[nodiscard]] std::string explain(
        std::string_view canonicalHornDocumentJson,
        std::string_view identity,
        std::string_view supportingArtifactsJson) const override;
};

class ImpactService final : public IImpactService {
public:
    [[nodiscard]] std::string assessImpact(
        std::string_view canonicalHornDocumentJson,
        std::string_view evidenceSnapshotJson,
        std::string_view bindingsJson) const override;
};

class DiffService final : public IDiffService {
public:
    [[nodiscard]] std::string diff(
        std::string_view beforeHornDocumentJson,
        std::string_view afterHornDocumentJson) const override;
};

} // namespace horn
