#include "QueryService.h"
#include "horn/RuntimeServices.h"

#include <memory>
#include <string>

#include "celix/BundleActivator.h"

namespace {
class QueryBundleActivator final {
public:
    explicit QueryBundleActivator(const std::shared_ptr<celix::BundleContext>& context) {
        auto service = std::make_shared<horn::QueryService>();
        registration_ = context->registerService<horn::IQueryService>(std::move(service))
            .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
            .addProperty("horn.query.request", std::string{horn::QUERY_REQUEST_CONTRACT})
            .addProperty("horn.query.result", std::string{horn::QUERY_RESULT_CONTRACT})
            .addProperty("horn.query.provider", std::string{"native-golden-equivalence-candidate"})
            .build();
    }

private:
    std::shared_ptr<celix::ServiceRegistration> registration_{};
};
} // namespace

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(QueryBundleActivator)
