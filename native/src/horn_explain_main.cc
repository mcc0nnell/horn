#include "JsonUtil.h"
#include "Reactor.h"

#include <iostream>
#include <stdexcept>

namespace {

horn::json loadSupport(int argc, char** argv) {
    horn::json support = horn::json::object();
    for (int i = 3; i < argc; ++i) {
        const horn::json parsed = horn::json::parse(horn::readFileUtf8(argv[i]));
        if (parsed.is_object() && horn::asString(parsed.value("version", horn::json())) ==
                                      "horn-argument/0.1") {
            support["argument"] = parsed;
            continue;
        }
        if (parsed.is_object() && horn::asString(parsed.value("version", horn::json())) ==
                                      "horn-extraction/0.1") {
            support["extraction"] = parsed;
            continue;
        }
        if (parsed.is_object() && parsed.contains("components") &&
            parsed.contains("dependencyGraph")) {
            support["evidence"] = parsed;
            continue;
        }
        if (parsed.is_object() && parsed.contains("bindings") && parsed.at("bindings").is_array()) {
            support["bindings"] = parsed.at("bindings");
        }
    }
    return support;
}

} // namespace

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "Usage: horn_explain <document> <identity> [supporting artifacts...]\n";
        return 2;
    }
    try {
        const std::string source = horn::readFileUtf8(argv[1]);
        const std::string support = loadSupport(argc, argv).dump();
        std::cout << horn::explainIdentityText(source, argv[2], support);
        return 0;
    } catch (const nlohmann::json::parse_error& error) {
        std::cerr << "Failed to parse JSON: " << error.what() << "\n";
        return 1;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 1;
    }
}
