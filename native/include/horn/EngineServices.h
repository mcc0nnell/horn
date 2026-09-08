#pragma once

#include <string>
#include <string_view>

namespace horn {

inline constexpr std::string_view ARGUMENT_CONTRACT = "horn-argument/0.1";
inline constexpr std::string_view RUNTIME_STATE_CONTRACT = "horn-runtime-state/0.1";
inline constexpr std::string_view RUNTIME_OPERATION_CONTRACT = "horn-runtime-operation/0.1";
inline constexpr std::string_view TRANSITION_RECEIPT_CONTRACT = "horn-transition-receipt/0.1";
inline constexpr std::string_view RUNTIME_TRANSITION_CONTRACT = "horn-runtime-transition/0.1";

/**
 * Deterministic traversal service for semantic Horn arguments.
 *
 * The service owns runtime navigation state only. It never rewrites a
 * horn-argument/0.1 artifact and it never touches horn-document geometry.
 * Inputs and outputs stay serialized until the runtime contracts are stable
 * enough to justify native domain ABI types.
 */
class ITraversalService {
public:
    static constexpr const char* NAME = "org.mcc0nnell.horn.traversal";
    static constexpr const char* VERSION = "1.0.0";

    virtual ~ITraversalService() noexcept = default;

    [[nodiscard]] virtual std::string initialState(
        std::string_view canonicalHornArgumentJson) const = 0;

    /**
     * Apply one canonical runtime operation.
     *
     * previousReceiptJson may be empty for the first transition. When present,
     * the receipt must verify and terminate at runtimeStateJson.
     *
     * Returns horn-runtime-transition/0.1 containing the next state and the
     * immutable transition receipt.
     */
    [[nodiscard]] virtual std::string transition(
        std::string_view canonicalHornArgumentJson,
        std::string_view runtimeStateJson,
        std::string_view operationJson,
        std::string_view previousReceiptJson = {}) const = 0;
};

} // namespace horn
