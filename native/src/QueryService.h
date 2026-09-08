#pragma once

#include "horn/RuntimeServices.h"

namespace horn {

class QueryService final : public IQueryService {
public:
    [[nodiscard]] std::string queryDocument(
        std::string_view canonicalHornDocumentJson,
        std::string_view hornQueryRequestJson) const override;
};

} // namespace horn
