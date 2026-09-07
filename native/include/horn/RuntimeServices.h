#pragma once

#include <string>
#include <string_view>
#include <vector>

namespace horn {

inline constexpr std::string_view RUNTIME_API_VERSION = "horn-runtime/0.1";
inline constexpr std::string_view DOCUMENT_CONTRACT = "horn-document/0.1";
inline constexpr std::string_view PROJECTION_CONTRACT = "horn-projection/0.1";

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

} // namespace horn
