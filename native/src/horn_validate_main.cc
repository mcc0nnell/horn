#include "DocumentValidator.h"

#include <fstream>
#include <iostream>
#include <stdexcept>
#include <sstream>
#include <string>

namespace {

std::string readFile(const std::string& path) {
    std::ifstream input(path);
    if (!input) {
        throw std::runtime_error("Failed to open " + path);
    }
    std::ostringstream buffer;
    buffer << input.rdbuf();
    return buffer.str();
}

} // namespace

int main(int argc, char** argv) {
    if (argc != 2) {
        std::cerr << "Usage: horn_validate <map.horn.json>\n";
        return 2;
    }

    try {
        const std::string source = readFile(argv[1]);
        const std::string report = horn::validateCanonicalHornDocument(source);
        std::cout << report;
        return 0;
    } catch (const nlohmann::json::parse_error& error) {
        std::cerr << "Failed to parse JSON: " << error.what() << "\n";
        return 1;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 1;
    }
}
