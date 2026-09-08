#include "ProofService.h"

#include <memory>
#include <string>

#include "celix/BundleActivator.h"

namespace {

class ProofBundleActivator final {
public:
    explicit ProofBundleActivator(const std::shared_ptr<celix::BundleContext>& context) {
        auto proof = std::make_shared<horn::ProofService>();
        registration_ =
            context->registerService<horn::IProofService>(std::move(proof))
                .addProperty("horn.runtime.api", std::string{horn::RUNTIME_API_VERSION})
                .addProperty("horn.proof.contract", std::string{horn::PROOF_CONTRACT})
                .addProperty(
                    "horn.proof.verification.contract",
                    std::string{horn::PROOF_VERIFICATION_CONTRACT})
                .addProperty("horn.provider.status", std::string{"golden-equivalence-candidate"})
                .build();
    }

private:
    std::shared_ptr<celix::ServiceRegistration> registration_{};
};

} // namespace

CELIX_GEN_CXX_BUNDLE_ACTIVATOR(ProofBundleActivator)
