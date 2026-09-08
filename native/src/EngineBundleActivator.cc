#include "horn/EngineServices.h"
#include "horn/TraversalRuntime.h"

#include <memory>
#include <string>
#include <utility>

#include "celix/BundleActivator.h"

namespace {

class TraversalService final : public horn::ITraversalService {
public:
    [[nodiscard]] std::string initialState(
        std::string_view canonicalHornArgumentJson) const override {
        return runtime_.initialState(canonicalHornArgumentJson);
    }

    [[nodiscard]] std::string transition(
        std::string_view canonicalHornArgumentJson,
        std::string_view runtimeStateJson,
        std::string_view operationJson,
        std::string_view previousReceiptJson) const override {
        return runtime_.transition(
            canonicalHornArgumentJson,
            runtimeStateJson,
            operationJson,
            previousReceiptJson);
    }

private:
    horn::TraversalRuntime runtime_{};
};

class EngineBundleActivator final {
public:
    explicit EngineBundleActivator(const std::shared_ptr<celix::BundleContext>& context) {
        auto traversal = std::make_shared<TraversalService>();
        traversalRegistration_ =
            context->registerService<horn::ITraversalService>(std::move(traversal))
                .addProperty("horn.argument.contract", std::string{horn::ARGUMENT_CONTRACT})
                .addProperty("horn.runtime.state", std::string{horn::RUNTIME_STATE_CONTRACT})
                .addProperty("horn.runtime.operation", std::string{horn::RUNTIME_OPERATION_CONTRACT})
                .addProperty("horn.transition.receipt", std::string{horn::TRANSITION_RECEIPT_CONTRACT})
                .build();
    }

private:
    std::shared_ptr<celix::ServiceRegistration> traversalRegistration_{};
};

} // namespace

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(EngineBundleActivator)
