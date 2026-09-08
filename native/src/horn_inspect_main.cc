#include "JsonUtil.h"
#include "Reactor.h"

#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

int main(int argc, char** argv) {
    if (argc < 2 || (argc >= 2 && std::string{argv[1]}.rfind("-", 0) == 0)) {
        std::cerr << "Usage: horn_inspect <document> [--projection view]... "
                     "[--explain-all] [--evidence file] [--bindings file] [--query file]\n";
        return 2;
    }
    try {
        const std::string source = horn::readFileUtf8(argv[1]);
        horn::json request = horn::json::object();
        request["projections"] = horn::json::array();
        request["queries"] = horn::json::array();
        request["explainAll"] = false;
        for (int i = 2; i < argc; ++i) {
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
                request["queries"].push_back(
                    horn::json::parse(horn::readFileUtf8(need("--query"))));
            } else {
                throw std::runtime_error("Unknown inspect flag " + flag);
            }
        }
        std::cout << horn::inspectDocumentText(source, request.dump());
        return 0;
    } catch (const nlohmann::json::parse_error& error) {
        std::cerr << "Failed to parse JSON: " << error.what() << "\n";
        return 1;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 1;
    }
}
