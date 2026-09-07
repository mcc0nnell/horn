#include "horn/rules/IHornRule.h"

#include "celix/BundleActivator.h"

#include <memory>

namespace horn::rules {
std::shared_ptr<IHornRule> createArgumentReadingDirectionRule();
}

class ReadingDirectionBundleActivator final {
public:
    explicit ReadingDirectionBundleActivator(const std::shared_ptr<celix::BundleContext>& ctx) {
        auto rule = horn::rules::createArgumentReadingDirectionRule();
        const auto metadata = rule->metadata();
        registration = ctx->registerService<horn::rules::IHornRule>(std::move(rule))
                           .addProperty("horn.rule.id", metadata.ruleId)
                           .addProperty("horn.rule.profile", metadata.profile)
                           .build();
    }

private:
    std::shared_ptr<celix::ServiceRegistration> registration{};
};

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(ReadingDirectionBundleActivator)
