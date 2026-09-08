#pragma once

#include <nlohmann/json.hpp>

#include <string>
#include <string_view>
#include <vector>

namespace horn {

using json = nlohmann::json;
using ordered_json = nlohmann::ordered_json;

[[nodiscard]] std::string asString(const json& value);
[[nodiscard]] bool asBool(const json& value, bool fallback = false);
[[nodiscard]] bool isFiniteNumber(const json& value);
[[nodiscard]] json jsonNumber(double value);
[[nodiscard]] json jsonNumberFrom(const json& value);

[[nodiscard]] json sortKeys(const json& value);
[[nodiscard]] std::string dumpNormalized(const json& value);
[[nodiscard]] std::string dumpCompactSorted(const json& value);

[[nodiscard]] std::string sha256Hex(std::string_view text);
[[nodiscard]] std::string sha256Prefixed(std::string_view text);

[[nodiscard]] std::vector<std::string> stringArray(const json& value);
[[nodiscard]] json objectOrEmpty(const json& value, const char* key);
[[nodiscard]] json arrayOrEmpty(const json& value, const char* key);

[[nodiscard]] std::string readFileUtf8(const std::string& path);

} // namespace horn
