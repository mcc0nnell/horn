#include "JsonUtil.h"
#include "Reactor.h"
#include "horn/RuntimeServices.h"

#include <celix/FrameworkFactory.h>
#include <celix_constants.h>

#include <algorithm>
#include <chrono>
#include <functional>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#ifndef HORN_CONTRACT_BUNDLE_FILE
#error "HORN_CONTRACT_BUNDLE_FILE must be defined to the HornContractBundle zip"
#endif

#ifndef HORN_CELIX_COMMIT
#define HORN_CELIX_COMMIT "unknown"
#endif

#ifndef HORN_CELIX_VERSION
#define HORN_CELIX_VERSION "unknown"
#endif

#ifndef HORN_CELIX_REPOSITORY
#define HORN_CELIX_REPOSITORY "https://github.com/apache/celix.git"
#endif

namespace {

horn::json loadExplainSupport(int argc, char** argv, int start) {
    horn::json support = horn::json::object();
    for (int i = start; i < argc; ++i) {
        const horn::json parsed = horn::json::parse(horn::readFileUtf8(argv[i]));
        if (parsed.is_object() &&
            horn::asString(parsed.value("version", horn::json())) == "horn-argument/0.1") {
            support["argument"] = parsed;
            continue;
        }
        if (parsed.is_object() &&
            horn::asString(parsed.value("version", horn::json())) == "horn-extraction/0.1") {
            support["extraction"] = parsed;
            continue;
        }
        if (parsed.is_object() && parsed.contains("components") &&
            parsed.contains("dependencyGraph")) {
            support["evidence"] = parsed;
            continue;
        }
        if (parsed.is_object() && parsed.contains("bindings") &&
            parsed.at("bindings").is_array()) {
            support["bindings"] = parsed.at("bindings");
        }
    }
    return support;
}

horn::json inspectRequestFromArgs(int argc, char** argv) {
    horn::json request = horn::json::object();
    request["projections"] = horn::json::array();
    request["queries"] = horn::json::array();
    request["explainAll"] = false;
    for (int i = 3; i < argc; ++i) {
        const std::string flag = argv[i];
        auto need = [&](const char* name) {
            if (i + 1 >= argc) {
                throw std::runtime_error(std::string(name) + " requires a value");
            }
            return std::string{argv[++i]};
        };
        if (flag == "--projection") {
            request["projections"].push_back(need("--projection"));
        } else if (flag == "--explain-all") {
            request["explainAll"] = true;
        } else if (flag == "--evidence") {
            request["evidence"] = horn::json::parse(horn::readFileUtf8(need("--evidence")));
        } else if (flag == "--bindings") {
            const horn::json parsed =
                horn::json::parse(horn::readFileUtf8(need("--bindings")));
            request["bindings"] = parsed.at("bindings");
        } else if (flag == "--query") {
            request["queries"].push_back(horn::json::parse(horn::readFileUtf8(need("--query"))));
        } else {
            throw std::runtime_error("Unknown inspect flag " + flag);
        }
    }
    return request;
}

class CelixRuntime {
public:
    CelixRuntime() {
        celix::Properties properties{};
        properties.set(CELIX_FRAMEWORK_CACHE_USE_TMP_DIR, true);
        properties.set("CELIX_LOGGING_DEFAULT_ACTIVE_LOG_LEVEL", "error");
        framework_ = celix::createFramework(properties);
        context_ = framework_->getFrameworkBundleContext();
        bundleId_ = context_->installBundle(HORN_CONTRACT_BUNDLE_FILE, true);
        if (bundleId_ < 0) {
            throw std::runtime_error(
                std::string("Failed to install HornContractBundle from ") +
                HORN_CONTRACT_BUNDLE_FILE);
        }
    }

    template <typename I>
    std::string use(const std::function<std::string(I&)>& fn) const {
        std::string out;
        const auto found = context_->useService<I>()
                               .setTimeout(std::chrono::seconds{5})
                               .addUseCallback([&](I& service) { out = fn(service); })
                               .build();
        if (found == 0) {
            throw std::runtime_error("Celix service not found: " + celix::typeName<I>());
        }
        return out;
    }

    template <typename I>
    void collect(horn::json& services) const {
        context_->useServices<I>()
            .addUseCallback([&](I&, const celix::Properties& props) {
                horn::json rec = horn::json::object();
                rec["interface"] = celix::typeName<I>();
                horn::json advertised = horn::json::object();
                for (auto it = props.begin(); it != props.end(); ++it) {
                    if (it.first.rfind("horn.", 0) == 0) {
                        advertised[it.first] = it.second;
                    }
                }
                rec["properties"] = advertised;
                services.push_back(std::move(rec));
            })
            .build();
    }

    [[nodiscard]] long bundleId() const { return bundleId_; }

    [[nodiscard]] horn::json probe() const {
        horn::json services = horn::json::array();
        collect<horn::IRuntimeDescriptor>(services);
        collect<horn::IValidationService>(services);
        collect<horn::IProjectionService>(services);
        collect<horn::IQueryService>(services);
        collect<horn::IExplanationService>(services);
        collect<horn::IImpactService>(services);
        collect<horn::IDiffService>(services);
        std::sort(services.begin(), services.end(), [](const horn::json& a, const horn::json& b) {
            return a.at("interface").get<std::string>() < b.at("interface").get<std::string>();
        });

        std::vector<std::string> views;
        context_->useService<horn::IRuntimeDescriptor>()
            .setTimeout(std::chrono::seconds{5})
            .addUseCallback([&](horn::IRuntimeDescriptor& descriptor) {
                for (const auto view : descriptor.projectionViews()) {
                    views.emplace_back(view);
                }
            })
            .build();

        horn::json pin = horn::json::object();
        pin["commit"] = HORN_CELIX_COMMIT;
        pin["repository"] = HORN_CELIX_REPOSITORY;
        pin["version"] = HORN_CELIX_VERSION;

        horn::json bundle = horn::json::object();
        bundle["id"] = bundleId_;
        bundle["symbolicName"] = "org.mcc0nnell.horn.runtime.contract";

        horn::json out = horn::json::object();
        out["bundle"] = bundle;
        out["ok"] = services.size() >= 7;
        out["pin"] = pin;
        out["projectionViews"] = views;
        out["runtime"] = std::string{horn::RUNTIME_API_VERSION};
        out["services"] = services;
        out["version"] = "horn-celix-probe/0.1";
        return out;
    }

    [[nodiscard]] std::string inspect(const std::string& source, const horn::json& request) const {
        horn::json packet = horn::json::object();
        packet["validation"] = horn::json::parse(
            use<horn::IValidationService>([&](horn::IValidationService& svc) {
                return svc.validateDocument(source);
            }));

        horn::json projections = horn::json::object();
        for (const auto& viewValue : horn::arrayOrEmpty(request, "projections")) {
            const auto view = horn::parseProjectionView(horn::asString(viewValue));
            projections[std::string{horn::projectionViewName(view)}] = horn::json::parse(
                use<horn::IProjectionService>([&](horn::IProjectionService& svc) {
                    return svc.projectDocument(source, view);
                }));
        }
        packet["projections"] = projections;

        horn::json support = horn::json::object();
        if (request.contains("evidence") && !request.at("evidence").is_null()) {
            support["evidence"] = request.at("evidence");
        }
        if (request.contains("bindings") && !request.at("bindings").is_null()) {
            support["bindings"] = request.at("bindings");
        }
        const std::string supportText = support.dump();

        horn::json explanations = horn::json::array();
        if (horn::asBool(request.value("explainAll", horn::json()), false)) {
            const horn::json document = horn::json::parse(source);
            auto pushIds = [&](const horn::json& items) {
                for (const auto& item : items) {
                    const std::string id = horn::asString(item.value("id", horn::json()));
                    explanations.push_back(horn::json::parse(
                        use<horn::IExplanationService>([&](horn::IExplanationService& svc) {
                            return svc.explain(source, id, supportText);
                        })));
                }
            };
            pushIds(horn::arrayOrEmpty(document, "nodes"));
            pushIds(horn::arrayOrEmpty(document, "relations"));
            pushIds(horn::arrayOrEmpty(document, "citations"));
            pushIds(horn::arrayOrEmpty(document, "regions"));
        }
        packet["explanations"] = explanations;

        horn::json queries = horn::json::array();
        for (const auto& query : horn::arrayOrEmpty(request, "queries")) {
            queries.push_back(horn::json::parse(use<horn::IQueryService>([&](horn::IQueryService& svc) {
                return svc.query(source, query.dump());
            })));
        }
        packet["queries"] = queries;

        horn::json impact = horn::json();
        if (request.contains("evidence") && !request.at("evidence").is_null() &&
            request.contains("bindings") && !request.at("bindings").is_null()) {
            impact = horn::json::parse(use<horn::IImpactService>([&](horn::IImpactService& svc) {
                return svc.assessImpact(source, request.at("evidence").dump(), request.at("bindings").dump());
            }));
        }
        packet["impact"] = impact;
        packet["runtime"] = std::string{horn::RUNTIME_API_VERSION};
        const horn::json document = horn::json::parse(source);
        packet["source"] = {
            {"digest", horn::sha256Prefixed(source)},
            {"documentId", horn::asString(document.value("id", horn::json()))},
            {"documentVersion", horn::asString(document.value("version", horn::json()))},
        };
        packet["version"] = std::string{horn::INSPECT_CONTRACT};
        return horn::dumpNormalized(packet);
    }

private:
    std::shared_ptr<celix::Framework> framework_{};
    std::shared_ptr<celix::BundleContext> context_{};
    long bundleId_{-1};
};

void usage() {
    std::cerr
        << "Usage: horn_celix <validate|project|query|explain|impact|diff|inspect|probe> ...\n"
           "  horn_celix validate <document>\n"
           "  horn_celix project <document> <argument|timeline|evidence|frontier>\n"
           "  horn_celix query <document> <query.json>\n"
           "  horn_celix explain <document> <identity> [supporting artifacts...]\n"
           "  horn_celix impact <document> <evidence> <bindings>\n"
           "  horn_celix diff <before> <after>\n"
           "  horn_celix inspect <document> [--projection view]... [--explain-all]\n"
           "             [--evidence file] [--bindings file] [--query file]\n"
           "  horn_celix probe\n";
}

} // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        usage();
        return 2;
    }
    const std::string op = argv[1];
    try {
        CelixRuntime runtime;
        if (op == "probe") {
            std::cout << horn::dumpNormalized(runtime.probe());
            return 0;
        }
        if (op == "validate") {
            if (argc != 3) {
                usage();
                return 2;
            }
            const std::string source = horn::readFileUtf8(argv[2]);
            std::cout << runtime.use<horn::IValidationService>(
                [&](horn::IValidationService& svc) { return svc.validateDocument(source); });
            return 0;
        }
        if (op == "project") {
            if (argc != 4) {
                usage();
                return 2;
            }
            const std::string source = horn::readFileUtf8(argv[2]);
            const auto view = horn::parseProjectionView(argv[3]);
            std::cout << runtime.use<horn::IProjectionService>([&](horn::IProjectionService& svc) {
                return svc.projectDocument(source, view);
            });
            return 0;
        }
        if (op == "query") {
            if (argc != 4) {
                usage();
                return 2;
            }
            const std::string source = horn::readFileUtf8(argv[2]);
            const std::string request = horn::readFileUtf8(argv[3]);
            std::cout << runtime.use<horn::IQueryService>(
                [&](horn::IQueryService& svc) { return svc.query(source, request); });
            return 0;
        }
        if (op == "explain") {
            if (argc < 4) {
                usage();
                return 2;
            }
            const std::string source = horn::readFileUtf8(argv[2]);
            const std::string support = loadExplainSupport(argc, argv, 4).dump();
            std::cout << runtime.use<horn::IExplanationService>(
                [&](horn::IExplanationService& svc) {
                    return svc.explain(source, argv[3], support);
                });
            return 0;
        }
        if (op == "impact") {
            if (argc != 5) {
                usage();
                return 2;
            }
            const std::string source = horn::readFileUtf8(argv[2]);
            const std::string evidence = horn::readFileUtf8(argv[3]);
            const horn::json bindingsFile = horn::json::parse(horn::readFileUtf8(argv[4]));
            const std::string bindings = bindingsFile.at("bindings").dump();
            std::cout << runtime.use<horn::IImpactService>([&](horn::IImpactService& svc) {
                return svc.assessImpact(source, evidence, bindings);
            });
            return 0;
        }
        if (op == "diff") {
            if (argc != 4) {
                usage();
                return 2;
            }
            const std::string before = horn::readFileUtf8(argv[2]);
            const std::string after = horn::readFileUtf8(argv[3]);
            std::cout << runtime.use<horn::IDiffService>(
                [&](horn::IDiffService& svc) { return svc.diff(before, after); });
            return 0;
        }
        if (op == "inspect") {
            if (argc < 3) {
                usage();
                return 2;
            }
            const std::string source = horn::readFileUtf8(argv[2]);
            std::cout << runtime.inspect(source, inspectRequestFromArgs(argc, argv));
            return 0;
        }
        usage();
        return 2;
    } catch (const nlohmann::json::parse_error& error) {
        std::cerr << "Failed to parse JSON: " << error.what() << "\n";
        return 1;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 1;
    }
}
