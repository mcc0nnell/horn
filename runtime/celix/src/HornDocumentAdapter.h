#pragma once

#include "horn/rules/IHornRule.h"

#include <filesystem>

namespace horn::rules {

[[nodiscard]] HornDocumentView loadHornDocumentView(const std::filesystem::path& path);

} // namespace horn::rules
