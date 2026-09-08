#include "QueryService.h"

#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

namespace {
std::string readFile(const char* path) {
    std::ifstream input{path, std::ios::binary};
    if (!input) throw std::runtime_error(std::string{"cannot open "} + path);
    std::ostringstream buffer;
    buffer << input.rdbuf();
    return buffer.str();
}
} // namespace

int main(int argc, char** argv) {
    if (argc != 3) {
        std::cerr << "Usage: horn_query <map.horn.json> <horn-query-request.json>\n";
        return 2;
    }
    try {
        const auto document = readFile(argv[1]);
        const auto request = readFile(argv[2]);
        horn::QueryService service;
        std::cout << service.queryDocument(document, request) << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
