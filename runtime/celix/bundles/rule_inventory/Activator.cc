#include "horn/rules/IHornRule.h"

#include "celix/BundleActivator.h"
#include "celix/IShellCommand.h"

#include <algorithm>
#include <cstdio>
#include <memory>
#include <string>
#include <vector>

class HornRuleInventoryCommand final : public celix::IShellCommand {
public:
    explicit HornRuleInventoryCommand(std::shared_ptr<celix::ServiceTracker<horn::rules::IHornRule>> tracker)
        : tracker{std::move(tracker)} {}

    void executeCommand(
        const std::string& /*commandLine*/,
        const std::vector<std::string>& /*commandArgs*/,
        FILE* outStream,
        FILE* /*errorStream*/) override {
        struct Row {
            std::string ruleId;
            std::string profile;
            std::string sourceEdition;
            std::string sourceLocation;
        };

        std::vector<Row> rows{};
        for (const auto& rule : tracker->getServices()) {
            const auto meta = rule->metadata();
            rows.push_back(Row{meta.ruleId, meta.profile, meta.sourceEdition, meta.sourceLocation});
        }
        std::sort(rows.begin(), rows.end(), [](const Row& lhs, const Row& rhs) {
            return lhs.ruleId < rhs.ruleId;
        });

        std::fprintf(outStream, "Horn methodology rules: %zu\n", rows.size());
        for (const auto& row : rows) {
            std::fprintf(
                outStream,
                "%-46s profile=%-10s source=%s [%s]\n",
                row.ruleId.c_str(),
                row.profile.c_str(),
                row.sourceEdition.c_str(),
                row.sourceLocation.c_str());
        }
    }

private:
    std::shared_ptr<celix::ServiceTracker<horn::rules::IHornRule>> tracker{};
};

class HornRuleInventoryBundleActivator final {
public:
    explicit HornRuleInventoryBundleActivator(const std::shared_ptr<celix::BundleContext>& ctx) {
        tracker = ctx->trackServices<horn::rules::IHornRule>().build();
        command = std::make_shared<HornRuleInventoryCommand>(tracker);
        registration = ctx->registerService<celix::IShellCommand>(command)
                           .addProperty(celix::IShellCommand::COMMAND_NAME, "horn::rules")
                           .addProperty(celix::IShellCommand::COMMAND_USAGE, "horn::rules")
                           .addProperty(celix::IShellCommand::COMMAND_DESCRIPTION, "List dynamically discovered Horn methodology rules")
                           .build();
    }

private:
    std::shared_ptr<celix::ServiceTracker<horn::rules::IHornRule>> tracker{};
    std::shared_ptr<HornRuleInventoryCommand> command{};
    std::shared_ptr<celix::ServiceRegistration> registration{};
};

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(HornRuleInventoryBundleActivator)
