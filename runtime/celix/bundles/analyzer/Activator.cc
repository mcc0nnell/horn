#include "HornDocumentAdapter.h"
#include "horn/rules/IHornRule.h"
#include "horn/rules/RuleUtils.h"

#include "celix/BundleActivator.h"
#include "celix/IShellCommand.h"

#include <cstdio>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {

const char* severityName(horn::rules::Severity severity) {
    switch (severity) {
        case horn::rules::Severity::ERROR:
            return "ERROR";
        case horn::rules::Severity::WARNING:
            return "WARN";
        case horn::rules::Severity::INFO:
            return "INFO";
    }
    return "INFO";
}

struct AnalyzeOptions {
    std::string path{};
    std::string profile{};
};

AnalyzeOptions parseArgs(const std::vector<std::string>& args) {
    if (args.empty()) {
        throw std::runtime_error{"usage: horn::analyze <document.horn.json> --profile horn-1998|horn-2003"};
    }

    AnalyzeOptions options{};
    options.path = args.front();
    for (std::size_t index = 1; index < args.size(); ++index) {
        if (args[index] == "--profile" && index + 1 < args.size()) {
            options.profile = args[++index];
            continue;
        }
        throw std::runtime_error{"unknown or incomplete argument: " + args[index]};
    }

    if (options.profile != "horn-1998" && options.profile != "horn-2003") {
        throw std::runtime_error{"--profile must be horn-1998 or horn-2003"};
    }
    return options;
}

class HornAnalyzeCommand final : public celix::IShellCommand {
public:
    explicit HornAnalyzeCommand(std::shared_ptr<celix::ServiceTracker<horn::rules::IHornRule>> tracker)
        : tracker{std::move(tracker)} {}

    void executeCommand(
        const std::string& /*commandLine*/,
        const std::vector<std::string>& commandArgs,
        FILE* outStream,
        FILE* errorStream) override {
        try {
            const auto options = parseArgs(commandArgs);
            const auto document = horn::rules::loadHornDocumentView(options.path);

            std::vector<horn::rules::Diagnostic> diagnostics{};
            std::size_t ruleCount = 0;
            for (const auto& rule : tracker->getServices()) {
                const auto metadata = rule->metadata();
                if (metadata.profile != options.profile) {
                    continue;
                }
                ++ruleCount;
                auto produced = rule->evaluate(document);
                diagnostics.insert(
                    diagnostics.end(),
                    std::make_move_iterator(produced.begin()),
                    std::make_move_iterator(produced.end()));
            }
            horn::rules::sortDiagnostics(diagnostics);

            std::fprintf(
                outStream,
                "Horn analysis document=%s profile=%s rules=%zu diagnostics=%zu\n",
                document.id.c_str(),
                options.profile.c_str(),
                ruleCount,
                diagnostics.size());

            for (const auto& diagnostic : diagnostics) {
                std::fprintf(
                    outStream,
                    "%s  %s  target=%s\n  %s\n",
                    severityName(diagnostic.severity),
                    diagnostic.ruleId.c_str(),
                    diagnostic.targetId.c_str(),
                    diagnostic.message.c_str());
                if (diagnostic.suggestion) {
                    std::fprintf(outStream, "  suggestion: %s\n", diagnostic.suggestion->c_str());
                }
                std::fprintf(
                    outStream,
                    "  source: %s — %s\n",
                    diagnostic.sourceEdition.c_str(),
                    diagnostic.sourceLocation.c_str());
            }
        } catch (const std::exception& error) {
            std::fprintf(errorStream, "horn::analyze: %s\n", error.what());
        }
    }

private:
    std::shared_ptr<celix::ServiceTracker<horn::rules::IHornRule>> tracker{};
};

class HornAnalyzerBundleActivator final {
public:
    explicit HornAnalyzerBundleActivator(const std::shared_ptr<celix::BundleContext>& ctx) {
        tracker = ctx->trackServices<horn::rules::IHornRule>().build();
        command = std::make_shared<HornAnalyzeCommand>(tracker);
        registration = ctx->registerService<celix::IShellCommand>(command)
                           .addProperty(celix::IShellCommand::COMMAND_NAME, "horn::analyze")
                           .addProperty(
                               celix::IShellCommand::COMMAND_USAGE,
                               "horn::analyze <document.horn.json> --profile horn-1998|horn-2003")
                           .addProperty(
                               celix::IShellCommand::COMMAND_DESCRIPTION,
                               "Evaluate dynamically discovered Horn methodology rules against a read-only Horn document")
                           .build();
    }

private:
    std::shared_ptr<celix::ServiceTracker<horn::rules::IHornRule>> tracker{};
    std::shared_ptr<HornAnalyzeCommand> command{};
    std::shared_ptr<celix::ServiceRegistration> registration{};
};

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(HornAnalyzerBundleActivator)

} // namespace
