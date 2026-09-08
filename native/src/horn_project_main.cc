#include "JsonUtil.h"
#include "Reactor.h"

#include <iostream>
#include <stdexcept>

int main(int argc, char** argv) {
    if (argc != 3) {
        std::cerr << "Usage: horn_project <document> <argument|timeline|evidence|frontier>\n";
        return 2;
    }
    try {
        const std::string source = horn::readFileUtf8(argv[1]);
        const auto view = horn::parseProjectionView(argv[2]);
        std::cout << horn::projectAnalyticalViewText(source, view);
        return 0;
    } catch (const nlohmann::json::parse_error& error) {
        std::cerr << "Failed to parse JSON: " << error.what() << "\n";
        return 1;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 1;
    }
}
