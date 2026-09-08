#include "DocumentValidator.h"

#include <algorithm>
#include <limits>
#include <cmath>
#include <set>
#include <unordered_map>
#include <unordered_set>

namespace horn {
namespace {

using nlohmann::json;
using nlohmann::ordered_json;

bool isNumber(const json& value) {
    return value.is_number();
}

bool finitePositive(const json& value) {
    if (!isNumber(value)) {
        return false;
    }
    const double number = value.get<double>();
    return std::isfinite(number) && number > 0.0;
}

bool finiteNonNegative(const json& value) {
    if (!isNumber(value)) {
        return false;
    }
    const double number = value.get<double>();
    return std::isfinite(number) && number >= 0.0;
}

bool isFiniteNumber(const json& value) {
    return isNumber(value) && std::isfinite(value.get<double>());
}

bool isPositiveInteger(const json& value) {
    if (!value.is_number()) {
        return false;
    }
    const double number = value.get<double>();
    if (!std::isfinite(number) || number < 1.0) {
        return false;
    }
    // Number.isInteger equivalent: finite and trunc(n) === n
    return std::trunc(number) == number;
}

bool pointInsideCanvas(double x, double y, double canvasWidth, double canvasHeight) {
    return std::isfinite(x) && std::isfinite(y) && x >= 0.0 && y >= 0.0 &&
           x <= canvasWidth && y <= canvasHeight;
}

std::string asString(const json& value) {
    if (value.is_string()) {
        return value.get<std::string>();
    }
    return {};
}

void validateRect(
    std::vector<HornIssue>& issues,
    const json& rect,
    double canvasWidth,
    double canvasHeight,
    const std::string& subject) {
    if (!rect.is_object() || !finiteNonNegative(rect.value("x", json())) ||
        !finiteNonNegative(rect.value("y", json())) ||
        !finitePositive(rect.value("w", json())) ||
        !finitePositive(rect.value("h", json()))) {
        issues.push_back({"invalid-geometry", subject + " has invalid geometry"});
        return;
    }

    const double x = rect.at("x").get<double>();
    const double y = rect.at("y").get<double>();
    const double w = rect.at("w").get<double>();
    const double h = rect.at("h").get<double>();
    if (x + w > canvasWidth || y + h > canvasHeight) {
        issues.push_back(
            {"geometry-outside-canvas", subject + " extends outside the canvas"});
    }
}

bool controlPointsAreFinite(const json& command) {
    const std::string op = asString(command.value("op", json()));
    if (op == "Q") {
        return isFiniteNumber(command.value("x1", json())) &&
               isFiniteNumber(command.value("y1", json()));
    }
    if (op == "C") {
        return isFiniteNumber(command.value("x1", json())) &&
               isFiniteNumber(command.value("y1", json())) &&
               isFiniteNumber(command.value("x2", json())) &&
               isFiniteNumber(command.value("y2", json()));
    }
    return true;
}

bool commandEndpoint(const json& command, double& x, double& y) {
    const std::string op = asString(command.value("op", json()));
    if (op == "M" || op == "L" || op == "Q" || op == "C") {
        if (!isNumber(command.value("x", json())) ||
            !isNumber(command.value("y", json()))) {
            x = std::numeric_limits<double>::quiet_NaN();
            y = std::numeric_limits<double>::quiet_NaN();
            return true;
        }
        x = command.at("x").get<double>();
        y = command.at("y").get<double>();
        return true;
    }
    return false;
}

void validateRoute(
    std::vector<HornIssue>& issues,
    const json& route,
    double canvasWidth,
    double canvasHeight,
    const std::string& relationId) {
    if (!route.is_object() || !route.contains("commands") ||
        !route.at("commands").is_array()) {
        issues.push_back(
            {"route-too-short",
             "Relation " + relationId +
                 " route needs a move plus at least one drawing command"});
        return;
    }

    const auto& commands = route.at("commands");
    if (commands.size() < 2) {
        issues.push_back(
            {"route-too-short",
             "Relation " + relationId +
                 " route needs a move plus at least one drawing command"});
        return;
    }

    if (asString(commands.at(0).value("op", json())) != "M") {
        issues.push_back(
            {"route-missing-move",
             "Relation " + relationId + " route must begin with M"});
    }

    bool drawable = false;
    for (const auto& command : commands) {
        const std::string op = asString(command.value("op", json()));
        if (op == "L" || op == "Q" || op == "C") {
            drawable = true;
            break;
        }
    }
    if (!drawable) {
        issues.push_back(
            {"route-not-drawable",
             "Relation " + relationId + " route has no drawable segment"});
    }

    std::size_t index = 0;
    for (const auto& command : commands) {
        if (!controlPointsAreFinite(command)) {
            issues.push_back(
                {"invalid-route-control-point",
                 "Relation " + relationId + " route command " +
                     std::to_string(index) + " has a non-finite control point"});
        }

        double x = 0.0;
        double y = 0.0;
        if (commandEndpoint(command, x, y)) {
            if (!pointInsideCanvas(x, y, canvasWidth, canvasHeight)) {
                issues.push_back(
                    {"route-outside-canvas",
                     "Relation " + relationId + " route command " +
                         std::to_string(index) + " ends outside the canvas"});
            }
        }
        ++index;
    }

    if (route.contains("labelGeometry") && !route.at("labelGeometry").is_null()) {
        validateRect(
            issues,
            route.at("labelGeometry"),
            canvasWidth,
            canvasHeight,
            "Relation " + relationId + " label");
    }
}

} // namespace

std::vector<HornIssue> validateHornDocumentJson(const json& doc) {
    std::vector<HornIssue> issues;

    if (!doc.is_object()) {
        issues.push_back({"version", "Unsupported version "});
        return issues;
    }

    const std::string version = asString(doc.value("version", json()));
    if (version != "horn-document/0.1") {
        issues.push_back({"version", "Unsupported version " + version});
    }

    const json canvas = doc.value("canvas", json::object());
    const double canvasWidth =
        canvas.is_object() && isNumber(canvas.value("width", json()))
            ? canvas.at("width").get<double>()
            : std::numeric_limits<double>::quiet_NaN();
    const double canvasHeight =
        canvas.is_object() && isNumber(canvas.value("height", json()))
            ? canvas.at("height").get<double>()
            : std::numeric_limits<double>::quiet_NaN();

    if (!finitePositive(canvas.value("width", json())) ||
        !finitePositive(canvas.value("height", json()))) {
        issues.push_back(
            {"invalid-canvas",
             "Canvas width and height must be finite positive numbers"});
    }

    const std::string authority = asString(doc.value("authority", json()));
    const bool hasAfter = doc.contains("after") && !doc.at("after").is_null();
    if (authority == "authored") {
        bool afterOk = false;
        if (hasAfter && doc.at("after").is_object()) {
            const auto& after = doc.at("after");
            const std::string name = asString(after.value("name", json()));
            const bool nameOk = !name.empty() ||
                (after.contains("name") && after.at("name").is_string() &&
                 !after.at("name").get<std::string>().empty());
            // Match TS: doc.after.name.trim() === ""
            std::string trimmed = name;
            const auto first = trimmed.find_first_not_of(" \t\n\r\f\v");
            if (first == std::string::npos) {
                trimmed.clear();
            } else {
                const auto last = trimmed.find_last_not_of(" \t\n\r\f\v");
                trimmed = trimmed.substr(first, last - first + 1);
            }
            const bool worksOk = after.contains("works") && after.at("works").is_array() &&
                                 after.at("works").size() >= 1;
            afterOk = !trimmed.empty() && worksOk;
            (void)nameOk;
        }
        if (!afterOk) {
            issues.push_back(
                {"missing-after",
                 "Authored documents must identify who/what they are after"});
        }
    } else if (hasAfter) {
        issues.push_back(
            {"after-in-historical",
             "Historical documents must not carry authored 'after' metadata"});
    }

    std::unordered_map<std::string, json> citationById;
    const json citations = doc.value("citations", json::array());
    if (citations.is_array()) {
        for (const auto& citation : citations) {
            if (!citation.is_object()) {
                continue;
            }
            const std::string id = asString(citation.value("id", json()));
            if (citationById.find(id) != citationById.end()) {
                issues.push_back(
                    {"duplicate-citation-id", "Duplicate citation id " + id});
            }
            citationById.emplace(id, citation);
        }
    }

    bool hasCartographic = false;
    if (citations.is_array()) {
        for (const auto& citation : citations) {
            if (citation.is_object() &&
                asString(citation.value("layer", json())) == "cartographic") {
                hasCartographic = true;
                break;
            }
        }
    }
    if (!hasCartographic) {
        issues.push_back(
            {"missing-layer-b",
             "Document has no cartographic (Layer B) provenance"});
    }

    std::unordered_set<std::string> nodeIds;
    std::set<double> nodeNumbers;
    int authoredNodeCount = 0;

    const json nodes = doc.value("nodes", json::array());
    if (nodes.is_array()) {
        for (const auto& node : nodes) {
            if (!node.is_object()) {
                continue;
            }
            const std::string nodeId = asString(node.value("id", json()));
            if (nodeIds.find(nodeId) != nodeIds.end()) {
                issues.push_back(
                    {"duplicate-node-id", "Duplicate node id " + nodeId});
            }
            nodeIds.insert(nodeId);

            const json numberValue = node.value("number", json());
            if (!isPositiveInteger(numberValue)) {
                issues.push_back(
                    {"invalid-number",
                     "Node " + nodeId + " must have a positive integer number"});
            } else {
                const double number = numberValue.get<double>();
                if (nodeNumbers.find(number) != nodeNumbers.end()) {
                    issues.push_back(
                        {"duplicate-number",
                         "Duplicate node number " +
                             std::to_string(static_cast<long long>(number))});
                }
                nodeNumbers.insert(number);
            }

            const std::string origin = asString(node.value("origin", json()));
            if (origin == "authored") {
                authoredNodeCount += 1;
                if (authority == "historical") {
                    issues.push_back(
                        {"authored-in-historical",
                         "Authored node " + nodeId +
                             " cannot live in a historical document"});
                }
            }

            validateRect(
                issues,
                node.value("geometry", json()),
                canvasWidth,
                canvasHeight,
                "Node " + nodeId);

            std::set<std::string> layers;
            const json citationIds = node.value("citationIds", json::array());
            if (citationIds.is_array()) {
                for (const auto& cidValue : citationIds) {
                    const std::string cid = asString(cidValue);
                    const auto found = citationById.find(cid);
                    if (found == citationById.end()) {
                        issues.push_back(
                            {"missing-citation",
                             "Node " + nodeId + " references unknown citation " +
                                 cid});
                    } else {
                        const std::string layer =
                            asString(found->second.value("layer", json()));
                        if (layer == "mapped" || layer == "cartographic") {
                            layers.insert(layer);
                        }
                    }
                }
            }

            if (origin == "debate" && layers.find("mapped") == layers.end()) {
                issues.push_back(
                    {"missing-layer-a",
                     "Debate node " + nodeId +
                         " has no mapped (Layer A) citation"});
            }
            if (origin == "authored" &&
                layers.find("cartographic") == layers.end()) {
                issues.push_back(
                    {"missing-cartographic-provenance",
                     "Authored node " + nodeId +
                         " has no cartographic citation"});
            }
        }
    }

    if (authority == "authored" && authoredNodeCount < 1) {
        issues.push_back(
            {"missing-authored-node",
             "Authored documents must contain at least one explicitly authored "
             "node"});
    }

    std::unordered_set<std::string> regionIds;
    const json regions = doc.value("regions", json::array());
    if (regions.is_array()) {
        for (const auto& region : regions) {
            if (!region.is_object()) {
                continue;
            }
            const std::string regionId = asString(region.value("id", json()));
            if (regionIds.find(regionId) != regionIds.end()) {
                issues.push_back(
                    {"duplicate-region-id",
                     "Duplicate region id " + regionId});
            }
            regionIds.insert(regionId);
            validateRect(
                issues,
                region.value("geometry", json()),
                canvasWidth,
                canvasHeight,
                "Region " + regionId);
        }
    }

    std::unordered_set<std::string> relationIds;
    const json relations = doc.value("relations", json::array());
    if (relations.is_array()) {
        for (const auto& rel : relations) {
            if (!rel.is_object()) {
                continue;
            }
            const std::string relId = asString(rel.value("id", json()));
            if (relationIds.find(relId) != relationIds.end()) {
                issues.push_back(
                    {"duplicate-relation-id",
                     "Duplicate relation id " + relId});
            }
            relationIds.insert(relId);

            const std::string from = asString(rel.value("from", json()));
            const std::string to = asString(rel.value("to", json()));
            if (nodeIds.find(from) == nodeIds.end() ||
                nodeIds.find(to) == nodeIds.end()) {
                issues.push_back(
                    {"dangling-relation",
                     "Relation " + relId + " has unresolved endpoints"});
            }
            if (from == to) {
                issues.push_back(
                    {"self-relation",
                     "Relation " + relId + " points a node at itself"});
            }

            const bool hasRoute = rel.contains("route") && !rel.at("route").is_null();
            if (authority == "historical" && !hasRoute) {
                issues.push_back(
                    {"missing-relation-geometry",
                     "Historical relation " + relId +
                         " has no authored route"});
            }
            if (hasRoute) {
                validateRoute(
                    issues, rel.at("route"), canvasWidth, canvasHeight, relId);
            }
        }
    }

    std::unordered_set<std::string> pathIds;
    const json readingPath = doc.value("readingPath", json::array());
    if (readingPath.is_array()) {
        for (const auto& idValue : readingPath) {
            const std::string id = asString(idValue);
            if (nodeIds.find(id) == nodeIds.end()) {
                issues.push_back(
                    {"dangling-path",
                     "Reading path references unknown node " + id});
            }
            if (pathIds.find(id) != pathIds.end()) {
                issues.push_back(
                    {"duplicate-path-entry",
                     "Reading path repeats node " + id});
            }
            pathIds.insert(id);
        }
    }

    return issues;
}

std::string toValidationReportJson(
    std::string_view documentId,
    std::vector<HornIssue> issues) {
    std::sort(
        issues.begin(),
        issues.end(),
        [](const HornIssue& a, const HornIssue& b) {
            if (a.code != b.code) {
                return a.code < b.code;
            }
            return a.message < b.message;
        });

    ordered_json report;
    report["version"] = "horn-validation-report/0.1";
    report["documentContract"] = "horn-document/0.1";
    report["documentId"] = std::string{documentId};
    report["ok"] = issues.empty();
    report["issues"] = ordered_json::array();
    for (const auto& issue : issues) {
        ordered_json entry;
        entry["code"] = issue.code;
        entry["message"] = issue.message;
        report["issues"].push_back(std::move(entry));
    }

    return report.dump(2) + "\n";
}

std::string validateCanonicalHornDocument(
    std::string_view canonicalHornDocumentJson) {
    // Throws nlohmann::json::parse_error on invalid JSON (same as TS JSON.parse).
    const json doc = json::parse(canonicalHornDocumentJson);
    const std::string documentId =
        doc.is_object() ? asString(doc.value("id", json())) : std::string{};
    auto issues = validateHornDocumentJson(doc);
    return toValidationReportJson(documentId, std::move(issues));
}

std::string ValidationService::validateDocument(
    std::string_view canonicalHornDocumentJson) const {
    return validateCanonicalHornDocument(canonicalHornDocumentJson);
}

} // namespace horn
