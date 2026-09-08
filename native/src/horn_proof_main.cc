#include "ProofService.h"

#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

namespace {

std::string readFile(const std::string& path) {
    std::ifstream input{path};
    if (!input) {
        throw std::runtime_error{"cannot open " + path};
    }
    std::ostringstream out;
    out << input.rdbuf();
    return out.str();
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc != 4) {
            std::cerr << "usage: horn_proof <create|verify> <document.horn.json> <request-or-proof.json>\n";
            return 2;
        }

        const std::string mode = argv[1];
        const auto document = readFile(argv[2]);
        const auto input = readFile(argv[3]);
        horn::ProofService service;

        std::string result;
        if (mode == "create") {
            result = service.createProof(document, input);
        } else if (mode == "verify") {
            result = service.verifyProof(document, input);
        } else {
            std::cerr << "unknown mode: " << mode << "\n";
            return 2;
        }

        std::cout << nlohmann::json::parse(result).dump(2) << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
