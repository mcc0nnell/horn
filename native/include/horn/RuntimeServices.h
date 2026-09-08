#pragma once

#include <string>
#include <string_view>
#include <vector>

namespace horn {

inline constexpr std::string_view RUNTIME_API_VERSION = "horn-runtime/0.1";
inline constexpr std::string_view DOCUMENT_CONTRACT = "horn-document/0.1";
inline constexpr std::string_view PROJECTION_CONTRACT = "horn-projection/0.1";
inline constexpr std::string_view QUERY_CONTRACT = "horn-query/0.1";
inline constexpr std::string_view QUERY_RESULT_CONTRACT = "horn-query-result/0.1";
inline constexpr std::string_view EXPLANATION_CONTRACT = "horn-explanation/0.1";
inline constexpr std::string_view IMPACT_CONTRACT = "horn-impact-report/0.1";
inline constexpr std::string_view DIFF_CONTRACT = "horn-diff/0.1";
inline constexpr std::string_view INSPECT_CONTRACT = "horn-inspect/0.1";
inline constexpr std::string_view VALIDATION_REPORT_CONTRACT =
    "horn-validation-report/0.1";
inline constexpr std::string_view REASONING_SESSION_CONTRACT =
    "horn-reasoning-session/0.1";
inline constexpr std::string_view REASONING_SESSION_REQUEST_CONTRACT =
    "horn-reasoning-session-request/0.1";
inline constexpr std::string_view REASONING_SESSION_RESPONSE_CONTRACT =
    "horn-reasoning-session-response/0.1";
inline constexpr std::string_view REASONING_BINDINGS_CONTRACT =
    "horn-reasoning-bindings/0.1";

enum class ProjectionView {
    Argument,
    Timeline,
    Evidence,
    Frontier,
};

[[nodiscard]] inline constexpr std::string_view projectionViewName(
    ProjectionView view) noexcept {
    switch (view) {
        case ProjectionView::Argument:
            return "argument";
        case ProjectionView::Timeline:
            return "timeline";
        case ProjectionView::Evidence:
            return "evidence";
        case ProjectionView::Frontier:
            return "frontier";
    }
    return "unknown";
}

/**
 * Describes the native Horn runtime boundary without taking ownership of
 * Horn document or projection semantics.
 */
class IRuntimeDescriptor {
public:
    virtual ~IRuntimeDescriptor() noexcept = default;

    [[nodiscard]] virtual std::string_view runtimeApiVersion() const noexcept = 0;
    [[nodiscard]] virtual std::string_view documentContract() const noexcept = 0;
    [[nodiscard]] virtual std::string_view projectionContract() const noexcept = 0;
    [[nodiscard]] virtual std::vector<std::string_view> projectionViews() const = 0;
};

/**
 * Native validation seam.
 *
 * Input and output are serialized contract artifacts on purpose: parsing and
 * schema evolution remain outside the C++ service ABI until the semantic core
 * is stable enough to freeze native domain types.
 */
class IValidationService {
public:
    virtual ~IValidationService() noexcept = default;

    [[nodiscard]] virtual std::string validateDocument(
        std::string_view canonicalHornDocumentJson) const = 0;
};

/**
 * Native analytical projection seam.
 *
 * Implementations must derive a projection from the canonical Horn document.
 * They must never rewrite authored geometry or make the projection a new
 * serialization authority for the document.
 */
class IProjectionService {
public:
    virtual ~IProjectionService() noexcept = default;

    [[nodiscard]] virtual std::string projectDocument(
        std::string_view canonicalHornDocumentJson,
        ProjectionView view) const = 0;
};

/**
 * Artifact-based deterministic query seam, including counterfactual analysis.
 * Implementations must not mutate the source artifact.
 */
class IQueryService {
public:
    virtual ~IQueryService() noexcept = default;

    [[nodiscard]] virtual std::string query(
        std::string_view canonicalHornDocumentJson,
        std::string_view queryRequestJson) const = 0;
};

/**
 * Structured explanation of a Horn identity. Returns facts and paths, never
 * speculative narration.
 */
class IExplanationService {
public:
    virtual ~IExplanationService() noexcept = default;

    [[nodiscard]] virtual std::string explain(
        std::string_view canonicalHornDocumentJson,
        std::string_view identity,
        std::string_view supportingArtifactsJson) const = 0;
};

/**
 * Evidence impact report. Describes consequences only; never rewrites,
 * deletes, or silently downgrades an authored claim.
 */
class IImpactService {
public:
    virtual ~IImpactService() noexcept = default;

    [[nodiscard]] virtual std::string assessImpact(
        std::string_view canonicalHornDocumentJson,
        std::string_view evidenceSnapshotJson,
        std::string_view bindingsJson) const = 0;
};

/**
 * Deterministic semantic diff of two Horn artifacts.
 */
class IDiffService {
public:
    virtual ~IDiffService() noexcept = default;

    [[nodiscard]] virtual std::string diff(
        std::string_view beforeHornDocumentJson,
        std::string_view afterHornDocumentJson) const = 0;
};

/**
 * Ephemeral orchestration seam for composing derived reasoning results.
 *
 * The request carries the previous session envelope plus one operation. The
 * service resolves binding references and dispatches to discovered Horn
 * services, then returns the updated envelope. Session state is transported,
 * not persisted by the service. Canonical document operands are explicit
 * values and may never be satisfied by a derived binding reference.
 */
class IReasoningSessionService {
public:
    virtual ~IReasoningSessionService() noexcept = default;

    [[nodiscard]] virtual std::string execute(
        std::string_view reasoningSessionRequestJson) const = 0;
};

} // namespace horn
