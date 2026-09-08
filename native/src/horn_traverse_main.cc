#include "horn/TraversalRuntime.h"

#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace {

std::string readFile(std::string_view path) {
    std::ifstream input{std::string{path}};
    if (!input) {
        throw std::runtime_error{"cannot open file: " + std::string{path}};
    }
    std::ostringstream buffer;
    buffer << input.rdbuf();
    return buffer.str();
}

void usage(std::string_view program) {
    std::cerr
        << "usage:\n"
        << "  " << program << " init <argument.json>\n"
        << "  " << program
        << " step <argument.json> <state.json> <operation.json> [previous-receipt.json]\n";
}

} // namespace

int main(int argc, char** argv) {
    try {
        horn::TraversalRuntime runtime{};
        if (argc == 3 && std::string_view{argv[1]} == "init") {
            std::cout << runtime.initialState(readFile(argv[2])) << '\n';
            return 0;
        }

        if ((argc == 5 || argc == 6) && std::string_view{argv[1]} == "step") {
            const auto argument = readFile(argv[2]);
            const auto state = readFile(argv[3]);
            const auto operation = readFile(argv[4]);
            const auto previousReceipt = argc == 6 ? readFile(argv[5]) : std::string{};
            std::cout << runtime.transition(argument, state, operation, previousReceipt) << '\n';
            return 0;
        }

        usage(argv[0]);
        return 2;
    } catch (const std::exception& error) {
        std::cerr << "horn_traverse: " << error.what() << '\n';
        return 1;
    }
}
