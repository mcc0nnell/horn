#pragma once

#include <string>
#include <string_view>

namespace horn::detail {

[[nodiscard]] std::string sha256Hex(std::string_view value);

} // namespace horn::detail
