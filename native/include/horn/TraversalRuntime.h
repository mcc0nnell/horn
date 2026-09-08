#pragma once

#include <string>
#include <string_view>

namespace horn {

/**
 * Framework-free deterministic Horn traversal core.
 *
 * Apache Celix hosts this class through ITraversalService, but the semantics
 * intentionally have no Celix dependency. This keeps the same runtime rules
 * usable from native CLIs, tests, embedded hosts, and Celix bundles.
 */
class TraversalRuntime final {
public:
    [[nodiscard]] std::string initialState(
        std::string_view canonicalHornArgumentJson) const;

    [[nodiscard]] std::string transition(
        std::string_view canonicalHornArgumentJson,
        std::string_view runtimeStateJson,
        std::string_view operationJson,
        std::string_view previousReceiptJson = {}) const;
};

} // namespace horn
