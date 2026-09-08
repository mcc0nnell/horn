#pragma once

#include "horn/RuntimeServices.h"

namespace horn {

class ProofService final : public IProofService {
public:
    [[nodiscard]] std::string createProof(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornQueryRequestJson) const override;

    [[nodiscard]] std::string verifyProof(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornProofJson) const override;
};

} // namespace horn
