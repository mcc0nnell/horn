#include "JsonUtil.h"
#include "Reactor.h"

#include <iostream>
#include <stdexcept>

int main(int argc, char** argv) {
    if (argc != 4) {
        std::cerr << "Usage: horn_impact <document> <evidence> <bindings>\n";
        return 2;
    }
    try {
        const std::string source = horn::readFileUtf8(argv[1]);
        const std::string evidence = horn::readFileUtf8(argv[2]);
        const horn::json bindingsFile = horn::json::parse(horn::readFileUtf8(argv[3]));
        const std::string bindings = bindingsFile.at("bindings").dump();
        std::cout << horn::assessImpactText(source, evidence, bindings);
        return 0;
    } catch (const nlohmann::json::parse_error& error) {
        std::cerr << "Failed to parse JSON: " << error.what() << "\n";
        return 1;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 1;
    }
}
