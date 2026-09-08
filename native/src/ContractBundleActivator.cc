#include "DocumentValidator.h"
#include "Reactor.h"
#include "horn/RuntimeServices.h"

#include <memory>
#include <string_view>
#include <utility>
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
        descriptorRegistration_ =
            context->registerService<horn::IRuntimeDescriptor>(std::move(descriptor))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.projection.contract", std::string{horn::PROJECTION_CONTRACT})
                .build();

        // Composition is discovery-only. Application policy stays outside registration.
        // Consumers may walk: validation -> query/projection -> explanation/impact.
        auto validation = std::make_shared<horn::ValidationService>();
        validationRegistration_ =
            context->registerService<horn::IValidationService>(std::move(validation))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.validation.report", std::string{horn::VALIDATION_REPORT_CONTRACT})
                .build();

        auto projection = std::make_shared<horn::ProjectionService>();
        projectionRegistration_ =
            context->registerService<horn::IProjectionService>(std::move(projection))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.projection.contract", std::string{horn::PROJECTION_CONTRACT})
                .build();

        auto query = std::make_shared<horn::QueryService>();
        queryRegistration_ =
            context->registerService<horn::IQueryService>(std::move(query))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.query.contract", std::string{horn::QUERY_CONTRACT})
                .build();

        auto explanation = std::make_shared<horn::ExplanationService>();
        explanationRegistration_ =
            context->registerService<horn::IExplanationService>(std::move(explanation))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.explanation.contract", std::string{horn::EXPLANATION_CONTRACT})
                .build();

        auto impact = std::make_shared<horn::ImpactService>();
        impactRegistration_ =
            context->registerService<horn::IImpactService>(std::move(impact))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.impact.contract", std::string{horn::IMPACT_CONTRACT})
                .build();

        auto diff = std::make_shared<horn::DiffService>();
        diffRegistration_ =
            context->registerService<horn::IDiffService>(std::move(diff))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.diff.contract", std::string{horn::DIFF_CONTRACT})
                .build();
    }

private:
    std::shared_ptr<celix::ServiceRegistration> descriptorRegistration_{};
    std::shared_ptr<celix::ServiceRegistration> validationRegistration_{};
    std::shared_ptr<celix::ServiceRegistration> projectionRegistration_{};
    std::shared_ptr<celix::ServiceRegistration> queryRegistration_{};
    std::shared_ptr<celix::ServiceRegistration> explanationRegistration_{};
    std::shared_ptr<celix::ServiceRegistration> impactRegistration_{};
    std::shared_ptr<celix::ServiceRegistration> diffRegistration_{};
};

} // namespace

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(ContractBundleActivator)
