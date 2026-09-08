#include "JsonUtil.h"

#include "sha256.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <limits>
#include <sstream>
#include <stdexcept>

namespace horn {
namespace {

void writeEscaped(std::ostringstream& out, const std::string& value) {
    out << '"';
    for (unsigned char ch : value) {
        switch (ch) {
            case '"':
                out << "\\\"";
                break;
            case '\\':
                out << "\\\\";
                break;
            case '\b':
                out << "\\b";
                break;
            case '\f':
                out << "\\f";
                break;
            case '\n':
                out << "\\n";
                break;
            case '\r':
                out << "\\r";
                break;
            case '\t':
                out << "\\t";
                break;
            default:
                if (ch < 0x20) {
                    static const char* hex = "0123456789abcdef";
                    out << "\\u00" << hex[ch >> 4] << hex[ch & 0xF];
                } else {
                    out << static_cast<char>(ch);
                }
                break;
        }
    }
    out << '"';
}

void writePretty(std::ostringstream& out, const json& value, int indent, int depth);
void writeCompact(std::ostringstream& out, const json& value);

void writePretty(std::ostringstream& out, const json& value, int indent, int depth) {
    if (value.is_null()) {
        out << "null";
        return;
    }
    if (value.is_boolean()) {
        out << (value.get<bool>() ? "true" : "false");
        return;
    }
    if (value.is_number_integer() || value.is_number_unsigned()) {
        out << value.dump();
        return;
    }
    if (value.is_number_float()) {
        out << jsonNumberFrom(value).dump();
        return;
    }
    if (value.is_string()) {
        writeEscaped(out, value.get<std::string>());
        return;
    }
    if (value.is_array()) {
        if (value.empty()) {
            out << "[]";
            return;
        }
        out << "[\n";
        for (std::size_t i = 0; i < value.size(); ++i) {
            out << std::string(static_cast<std::size_t>((depth + 1) * indent), ' ');
            writePretty(out, value.at(i), indent, depth + 1);
            if (i + 1 < value.size()) {
                out << ',';
            }
            out << '\n';
        }
        out << std::string(static_cast<std::size_t>(depth * indent), ' ') << ']';
        return;
    }

    json sorted = sortKeys(value);
    if (sorted.empty()) {
        out << "{}";
        return;
    }
    out << "{\n";
    std::size_t index = 0;
    const std::size_t count = sorted.size();
    for (auto it = sorted.begin(); it != sorted.end(); ++it, ++index) {
        out << std::string(static_cast<std::size_t>((depth + 1) * indent), ' ');
        writeEscaped(out, it.key());
        out << ": ";
        writePretty(out, it.value(), indent, depth + 1);
        if (index + 1 < count) {
            out << ',';
        }
        out << '\n';
    }
    out << std::string(static_cast<std::size_t>(depth * indent), ' ') << '}';
}

void writeCompact(std::ostringstream& out, const json& value) {
    if (value.is_null()) {
        out << "null";
        return;
    }
    if (value.is_boolean()) {
        out << (value.get<bool>() ? "true" : "false");
        return;
    }
    if (value.is_number_integer() || value.is_number_unsigned()) {
        out << value.dump();
        return;
    }
    if (value.is_number_float()) {
        out << jsonNumberFrom(value).dump();
        return;
    }
    if (value.is_string()) {
        writeEscaped(out, value.get<std::string>());
        return;
    }
    if (value.is_array()) {
        out << '[';
        for (std::size_t i = 0; i < value.size(); ++i) {
            if (i > 0) {
                out << ',';
            }
            writeCompact(out, value.at(i));
        }
        out << ']';
        return;
    }
    json sorted = sortKeys(value);
    out << '{';
    bool first = true;
    for (auto it = sorted.begin(); it != sorted.end(); ++it) {
        if (!first) {
            out << ',';
        }
        first = false;
        writeEscaped(out, it.key());
        out << ':';
        writeCompact(out, it.value());
    }
    out << '}';
}

} // namespace

std::string asString(const json& value) {
    if (value.is_string()) {
        return value.get<std::string>();
    }
    return {};
}

bool asBool(const json& value, bool fallback) {
    if (value.is_boolean()) {
        return value.get<bool>();
    }
    return fallback;
}

bool isFiniteNumber(const json& value) {
    return value.is_number() && std::isfinite(value.get<double>());
}

json jsonNumber(double value) {
    if (std::isfinite(value) && std::trunc(value) == value &&
        value >= static_cast<double>(std::numeric_limits<long long>::min()) &&
        value <= static_cast<double>(std::numeric_limits<long long>::max())) {
        return static_cast<long long>(value);
    }
    return value;
}

json jsonNumberFrom(const json& value) {
    if (!value.is_number()) {
        return value;
    }
    return jsonNumber(value.get<double>());
}

json sortKeys(const json& value) {
    if (value.is_array()) {
        json out = json::array();
        for (const auto& item : value) {
            out.push_back(sortKeys(item));
        }
        return out;
    }
    if (value.is_object()) {
        std::vector<std::string> keys;
        keys.reserve(value.size());
        for (auto it = value.begin(); it != value.end(); ++it) {
            keys.push_back(it.key());
        }
        std::sort(keys.begin(), keys.end());
        json out = json::object();
        for (const auto& key : keys) {
            out[key] = sortKeys(value.at(key));
        }
        return out;
    }
    if (value.is_number_float()) {
        return jsonNumberFrom(value);
    }
    return value;
}

std::string dumpNormalized(const json& value) {
    std::ostringstream out;
    writePretty(out, sortKeys(value), 2, 0);
    out << '\n';
    return out.str();
}

std::string dumpCompactSorted(const json& value) {
    std::ostringstream out;
    writeCompact(out, sortKeys(value));
    return out.str();
}

std::string sha256Hex(std::string_view text) {
    return sha256::digestHex(text);
}

std::string sha256Prefixed(std::string_view text) {
    return "sha256:" + sha256Hex(text);
}

std::vector<std::string> stringArray(const json& value) {
    std::vector<std::string> out;
    if (!value.is_array()) {
        return out;
    }
    for (const auto& item : value) {
        out.push_back(asString(item));
    }
    return out;
}

json objectOrEmpty(const json& value, const char* key) {
    if (value.is_object() && value.contains(key) && value.at(key).is_object()) {
        return value.at(key);
    }
    return json::object();
}

json arrayOrEmpty(const json& value, const char* key) {
    if (value.is_object() && value.contains(key) && value.at(key).is_array()) {
        return value.at(key);
    }
    return json::array();
}

std::string readFileUtf8(const std::string& path) {
    std::ifstream input(path);
    if (!input) {
        throw std::runtime_error("Failed to open " + path);
    }
    std::ostringstream buffer;
    buffer << input.rdbuf();
    return buffer.str();
}

} // namespace horn
