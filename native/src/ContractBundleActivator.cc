#include "DocumentValidator.h"
#include "JsonUtil.h"
#include "Reactor.h"
#include "horn/RuntimeServices.h"

#include <algorithm>
#include <cctype>
#include <chrono>
#include <functional>
#include <memory>
#include <stdexcept>
#include <string>
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

[[nodiscard]] bool validBindingName(std::string_view name) {
    if (name.empty() || name.size() > 64 ||
        !std::isalpha(static_cast<unsigned char>(name.front()))) {
        return false;
    }
    for (const char c : name) {
        const auto uc = static_cast<unsigned char>(c);
        if (!std::isalnum(uc) && c != '.' && c != '_' && c != '-') {
            return false;
        }
    }
    return true;
}

[[nodiscard]] horn::json normalizeSession(const horn::json& candidate) {
    horn::json session = candidate.is_object() ? candidate : horn::json::object();
    if (!session.contains("version")) {
        session["version"] = std::string{horn::REASONING_SESSION_CONTRACT};
    }
    if (horn::asString(session.value("version", horn::json())) != horn::REASONING_SESSION_CONTRACT) {
        throw std::runtime_error("Unsupported Horn reasoning session contract");
    }
    if (!session.contains("id") || !session.at("id").is_string() ||
        session.at("id").get<std::string>().empty()) {
        session["id"] = "default";
    }
    session["ephemeral"] = true;
    if (!session.contains("bindings") || !session.at("bindings").is_array()) {
        session["bindings"] = horn::json::array();
    }
    return session;
}

[[nodiscard]] const horn::json& findBinding(
    const horn::json& session,
    std::string_view name) {
    for (const auto& binding : horn::arrayOrEmpty(session, "bindings")) {
        if (binding.is_object() &&
            horn::asString(binding.value("name", horn::json())) == name &&
            binding.contains("value")) {
            return binding;
        }
    }
    throw std::runtime_error("Unknown Horn reasoning binding @" + std::string{name});
}

[[nodiscard]] horn::json resolveReference(
    const horn::json& session,
    std::string_view reference) {
    if (reference.size() < 2 || reference.front() != '@') {
        throw std::runtime_error("Invalid Horn reasoning binding reference");
    }
    const auto hash = reference.find('#');
    const std::string name = std::string{reference.substr(
        1,
        hash == std::string_view::npos ? reference.size() - 1 : hash - 1)};
    if (!validBindingName(name)) {
        throw std::runtime_error("Invalid Horn reasoning binding name " + name);
    }

    const auto& binding = findBinding(session, name);
    const horn::json& value = binding.at("value");
    if (hash == std::string_view::npos) {
        return value;
    }

    const std::string pointerText = std::string{reference.substr(hash + 1)};
    if (!pointerText.empty() && pointerText.front() != '/') {
        throw std::runtime_error(
            "Horn reasoning binding selectors use JSON Pointer after #");
    }
    try {
        return value.at(horn::json::json_pointer{pointerText});
    } catch (const std::exception&) {
        throw std::runtime_error(
            "Horn reasoning binding selector did not resolve: " + std::string{reference});
    }
}

[[nodiscard]] horn::json resolveOperand(
    const horn::json& session,
    const horn::json& operand) {
    if (!operand.is_object()) {
        throw std::runtime_error("Horn reasoning operand must be an object");
    }
    if (operand.contains("ref")) {
        if (!operand.at("ref").is_string()) {
            throw std::runtime_error("Horn reasoning operand ref must be a string");
        }
        return resolveReference(session, operand.at("ref").get<std::string>());
    }
    if (operand.contains("value")) {
        return operand.at("value");
    }
    throw std::runtime_error("Horn reasoning operand requires value or ref");
}

[[nodiscard]] std::string canonicalDocumentText(
    const horn::json& operand,
    std::string_view label) {
    if (!operand.is_object() ||
        horn::asString(operand.value("authority", horn::json())) != "canonical" ||
        !operand.contains("value") || !operand.at("value").is_object()) {
        throw std::runtime_error(
            std::string{label} + " must be an explicit canonical Horn document value");
    }
    const auto& document = operand.at("value");
    if (horn::asString(document.value("version", horn::json())) != horn::DOCUMENT_CONTRACT) {
        throw std::runtime_error(
            std::string{label} + " is not a " + std::string{horn::DOCUMENT_CONTRACT});
    }
    return document.dump();
}

[[nodiscard]] horn::json mergeExplainSupport(const horn::json& values) {
    horn::json support = horn::json::object();
    for (const auto& parsed : values) {
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

[[nodiscard]] horn::json bindingsArray(const horn::json& value) {
    if (value.is_array()) {
        return value;
    }
    if (value.is_object() && value.contains("bindings") && value.at("bindings").is_array()) {
        return value.at("bindings");
    }
    throw std::runtime_error("Horn impact bindings operand must resolve to an array or bindings object");
}

void bindResult(
    horn::json& session,
    std::string_view name,
    std::string_view command,
    const horn::json& result) {
    if (!validBindingName(name)) {
        throw std::runtime_error("Invalid Horn reasoning binding name " + std::string{name});
    }
    auto& bindings = session["bindings"];
    horn::json replacement = horn::json::object();
    replacement["command"] = command;
    replacement["contract"] = result.is_object()
        ? horn::asString(result.value("version", horn::json()))
        : "";
    replacement["name"] = name;
    replacement["sha256"] = horn::sha256Prefixed(horn::dumpCompactSorted(result));
    replacement["value"] = result;

    horn::json next = horn::json::array();
    bool replaced = false;
    for (const auto& binding : bindings) {
        if (binding.is_object() &&
            horn::asString(binding.value("name", horn::json())) == name) {
            if (!replaced) {
                next.push_back(replacement);
                replaced = true;
            }
        } else {
            next.push_back(binding);
        }
    }
    if (!replaced) {
        next.push_back(replacement);
    }
    std::sort(next.begin(), next.end(), [](const horn::json& a, const horn::json& b) {
        return horn::asString(a.value("name", horn::json())) <
               horn::asString(b.value("name", horn::json()));
    });
    session["bindings"] = std::move(next);
}

[[nodiscard]] horn::json bindingSummary(const horn::json& session) {
    horn::json rows = horn::json::array();
    for (const auto& binding : horn::arrayOrEmpty(session, "bindings")) {
        horn::json row = horn::json::object();
        row["command"] = horn::asString(binding.value("command", horn::json()));
        row["contract"] = horn::asString(binding.value("contract", horn::json()));
        row["name"] = horn::asString(binding.value("name", horn::json()));
        row["sha256"] = horn::asString(binding.value("sha256", horn::json()));
        rows.push_back(std::move(row));
    }
    horn::json out = horn::json::object();
    out["bindings"] = rows;
    out["ephemeral"] = true;
    out["version"] = std::string{horn::REASONING_BINDINGS_CONTRACT};
    return out;
}

class ReasoningSessionService final : public horn::IReasoningSessionService {
public:
    explicit ReasoningSessionService(std::shared_ptr<celix::BundleContext> context)
        : context_{std::move(context)} {}

    [[nodiscard]] std::string execute(
        std::string_view reasoningSessionRequestJson) const override {
        const horn::json request = horn::json::parse(reasoningSessionRequestJson);
        if (!request.is_object() ||
            horn::asString(request.value("version", horn::json())) !=
                horn::REASONING_SESSION_REQUEST_CONTRACT) {
            throw std::runtime_error("Unsupported Horn reasoning session request contract");
        }
        if (!request.contains("command") || !request.at("command").is_object()) {
            throw std::runtime_error("Horn reasoning session request requires command");
        }

        horn::json session = normalizeSession(request.value("session", horn::json()));
        const auto& command = request.at("command");
        const std::string op = horn::asString(command.value("op", horn::json()));
        horn::json result;

        if (op == "bindings") {
            result = bindingSummary(session);
        } else if (op == "validate") {
            const std::string document = canonicalDocumentText(command.at("document"), "document");
            result = horn::json::parse(use<horn::IValidationService>(
                [&](horn::IValidationService& svc) {
                    return svc.validateDocument(document);
                }));
        } else if (op == "query") {
            const std::string document = canonicalDocumentText(command.at("document"), "document");
            const horn::json query = resolveOperand(session, command.at("request"));
            result = horn::json::parse(use<horn::IQueryService>(
                [&](horn::IQueryService& svc) {
                    return svc.query(document, query.dump());
                }));
        } else if (op == "explain") {
            const std::string document = canonicalDocumentText(command.at("document"), "document");
            const horn::json identityValue = resolveOperand(session, command.at("identity"));
            if (!identityValue.is_string()) {
                throw std::runtime_error("Horn explanation identity must resolve to a string");
            }
            horn::json supportValues = horn::json::array();
            for (const auto& operand : horn::arrayOrEmpty(command, "support")) {
                supportValues.push_back(resolveOperand(session, operand));
            }
            const std::string support = mergeExplainSupport(supportValues).dump();
            const std::string identity = identityValue.get<std::string>();
            result = horn::json::parse(use<horn::IExplanationService>(
                [&](horn::IExplanationService& svc) {
                    return svc.explain(document, identity, support);
                }));
        } else if (op == "impact") {
            const std::string document = canonicalDocumentText(command.at("document"), "document");
            const horn::json evidence = resolveOperand(session, command.at("evidence"));
            const horn::json bindings = bindingsArray(resolveOperand(session, command.at("bindings")));
            result = horn::json::parse(use<horn::IImpactService>(
                [&](horn::IImpactService& svc) {
                    return svc.assessImpact(document, evidence.dump(), bindings.dump());
                }));
        } else if (op == "diff") {
            const std::string before = canonicalDocumentText(command.at("before"), "before");
            const std::string after = canonicalDocumentText(command.at("after"), "after");
            result = horn::json::parse(use<horn::IDiffService>(
                [&](horn::IDiffService& svc) {
                    return svc.diff(before, after);
                }));
        } else {
            throw std::runtime_error("Unsupported Horn reasoning session operation " + op);
        }

        if (request.contains("bind") && !request.at("bind").is_null()) {
            if (!request.at("bind").is_string()) {
                throw std::runtime_error("Horn reasoning session bind must be a string");
            }
            bindResult(session, request.at("bind").get<std::string>(), op, result);
        }

        horn::json response = horn::json::object();
        response["result"] = result;
        response["session"] = session;
        response["version"] = std::string{horn::REASONING_SESSION_RESPONSE_CONTRACT};
        return horn::dumpNormalized(response);
    }

private:
    template <typename I>
    [[nodiscard]] std::string use(const std::function<std::string(I&)>& fn) const {
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

    std::shared_ptr<celix::BundleContext> context_{};
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

        auto session = std::make_shared<ReasoningSessionService>(context);
        sessionRegistration_ =
            context->registerService<horn::IReasoningSessionService>(std::move(session))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.document.contract", std::string{horn::DOCUMENT_CONTRACT})
                .addProperty("horn.reasoning.session.contract", std::string{horn::REASONING_SESSION_CONTRACT})
                .addProperty("horn.reasoning.session.request", std::string{horn::REASONING_SESSION_REQUEST_CONTRACT})
                .addProperty("horn.reasoning.session.response", std::string{horn::REASONING_SESSION_RESPONSE_CONTRACT})
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
    std::shared_ptr<celix::ServiceRegistration> sessionRegistration_{};
};

} // namespace

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(ContractBundleActivator)
