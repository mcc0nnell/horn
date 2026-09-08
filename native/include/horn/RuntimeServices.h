#pragma once

#include <string>
#include <string_view>
#include <vector>

namespace horn {

inline constexpr std::string_view RUNTIME_API_VERSION = "horn-runtime/0.1";
inline constexpr std::string_view DOCUMENT_CONTRACT = "horn-document/0.1";
inline constexpr std::string_view PROJECTION_CONTRACT = "horn-projection/0.1";
inline constexpr std::string_view QUERY_REQUEST_CONTRACT = "horn-query-request/0.1";
inline constexpr std::string_view QUERY_RESULT_CONTRACT = "horn-query-result/0.1";
inline constexpr std::string_view PROOF_CONTRACT = "horn-proof/0.1";
inline constexpr std::string_view PROOF_VERIFICATION_CONTRACT = "horn-proof-verification/0.1";
inline constexpr std::string_view TAPE_PLAN_CONTRACT = "horn-tape-plan/0.1";
inline constexpr std::string_view TAPE_CONTRACT = "horn-tape/0.1";
inline constexpr std::string_view TAPE_VERIFICATION_CONTRACT = "horn-tape-verification/0.1";

enum class ProjectionView {
    Argument,
    Timeline,
    Evidence,
    Frontier,
};

[[nodiscard]] inline constexpr std::string_view projectionViewName(ProjectionView view) noexcept {
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
 * Native deterministic query seam.
 *
 * Both parameters and the result are serialized Horn contract artifacts. A
 * provider may answer graph, counterfactual, dominator, minimum-cut, and later
 * query operations only after golden equivalence with the TypeScript reference
 * implementation is established.
 */
class IQueryService {
public:
    virtual ~IQueryService() noexcept = default;

    [[nodiscard]] virtual std::string queryDocument(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornQueryRequestJson) const = 0;
};

/**
 * Native proof orchestration seam.
 *
 * Proof generation and verification bind deterministic query results to the
 * canonical document digest and the structural dependency witness. A provider
 * should compose equivalent query behavior; it does not create a new Horn
 * semantic authority.
 */
class IProofService {
public:
    virtual ~IProofService() noexcept = default;

    [[nodiscard]] virtual std::string createProof(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornQueryRequestJson) const = 0;

    [[nodiscard]] virtual std::string verifyProof(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornProofJson) const = 0;
};

/**
 * Native reasoning-tape seam.
 *
 * A tape records receipt-chained traversal over canonical Horn identities. It
 * is derived replay evidence rather than authored Horn truth. Keep this seam
 * provider-free until TypeScript/native golden equivalence is demonstrated.
 */
class ITapeService {
public:
    virtual ~ITapeService() noexcept = default;

    [[nodiscard]] virtual std::string recordTape(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornTapePlanJson) const = 0;

    [[nodiscard]] virtual std::string verifyTape(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornTapeJson) const = 0;
};

} // namespace horn
