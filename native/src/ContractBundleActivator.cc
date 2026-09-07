#include "horn/RuntimeServices.h"

#include <memory>
#include <string_view>
#include <vector>

#include "celix/BundleActivator.h"

namespace {

class RuntimeDescriptor final : public horn::IRuntimeDescriptor {
public:
    [[nodiscard]] std::string_view runtimeApiVersion() const noexcept override {
        return horn::RUNTIME_API_VERSION;
    }

    [[nodiscard]] std::string_view documentContract() const noexcept override {
        return horn::DOCUMENT_CONTRACT;
    }

    [[nodiscard]] std::string_view projectionContract() const noexcept override {
        return horn::PROJECTION_CONTRACT;
    }

    [[nodiscard]] std::vector<std::string_view> projectionViews() const override {
        return {
            horn::projectionViewName(horn::ProjectionView::Argument),
            horn::projectionViewName(horn::ProjectionView::Timeline),
            horn::projectionViewName(horn::ProjectionView::Evidence),
            horn::projectionViewName(horn::ProjectionView::Frontier),
        };
    }
};

class ContractBundleActivator final {
public:
    explicit ContractBundleActivator(const std::shared_ptr<celix::BundleContext>& context) {
        auto descriptor = std::make_shared<RuntimeDescriptor>();
        registration_ = context->registerService<horn::IRuntimeDescriptor>(std::move(descriptor))
            .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
            .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
            .addProperty("horn.projection.contract", std::string{horn::PROJECTION_CONTRACT})
            .build();
    }

private:
    std::shared_ptr<celix::ServiceRegistration> registration_{};
};

} // namespace

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(ContractBundleActivator)
