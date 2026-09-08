#include "Reactor.h"

#include "DocumentValidator.h"
#include "JsonUtil.h"

#include <algorithm>
#include <map>
#include <queue>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>
#include <utility>

namespace horn {
namespace {

const std::vector<std::string> kDialectical = {
    "supports",
    "disputes",
    "interprets-as",
};

const std::vector<std::string> kSupport = {"supports"};
const std::vector<std::string> kChallenge = {"disputes"};

json nodesOf(const json& document) {
    return arrayOrEmpty(document, "nodes");
}
json relationsOf(const json& document) {
    return arrayOrEmpty(document, "relations");
}
json citationsOf(const json& document) {
    return arrayOrEmpty(document, "citations");
}
json regionsOf(const json& document) {
    return arrayOrEmpty(document, "regions");
}

std::unordered_map<std::string, json> indexById(const json& items) {
    std::unordered_map<std::string, json> out;
    if (!items.is_array()) {
        return out;
    }
    for (const auto& item : items) {
        if (item.is_object()) {
            out[asString(item.value("id", json()))] = item;
        }
    }
    return out;
}

double nodeNumber(const json& node) {
    if (node.is_object() && isFiniteNumber(node.value("number", json()))) {
        return node.at("number").get<double>();
    }
    return 0.0;
}

bool isFocus(const json& node) {
    return node.is_object() && node.contains("focus") && asBool(node.at("focus"));
}

json quotedNode(const json& node) {
    json quoted = json::object();
    quoted["citationIds"] = arrayOrEmpty(node, "citationIds");
    quoted["id"] = asString(node.value("id", json()));
    quoted["kind"] = asString(node.value("kind", json()));
    quoted["label"] = asString(node.value("label", json()));
    quoted["number"] = jsonNumberFrom(node.value("number", json()));
    quoted["origin"] = asString(node.value("origin", json()));
    quoted["text"] = asString(node.value("text", json()));
    if (isFocus(node)) {
        quoted["focus"] = true;
    }
    if (node.contains("author") && node.at("author").is_string()) {
        quoted["author"] = node.at("author");
    }
    if (node.contains("authorShort") && node.at("authorShort").is_string()) {
        quoted["authorShort"] = node.at("authorShort");
    }
    if (node.contains("year") && isFiniteNumber(node.at("year"))) {
        quoted["year"] = jsonNumberFrom(node.at("year"));
    }
    if (node.contains("notes") && node.at("notes").is_string()) {
        quoted["notes"] = node.at("notes");
    }
    return quoted;
}

json quotedRelation(const json& relation) {
    json quoted = json::object();
    quoted["from"] = asString(relation.value("from", json()));
    quoted["id"] = asString(relation.value("id", json()));
    quoted["kind"] = asString(relation.value("kind", json()));
    quoted["label"] = asString(relation.value("label", json()));
    quoted["to"] = asString(relation.value("to", json()));
    return quoted;
}

json quotedCitation(const json& citation) {
    json quoted = json::object();
    quoted["citation"] = asString(citation.value("citation", json()));
    quoted["id"] = asString(citation.value("id", json()));
    quoted["layer"] = asString(citation.value("layer", json()));
    quoted["short"] = asString(citation.value("short", json()));
    quoted["year"] = jsonNumberFrom(citation.value("year", json()));
    if (citation.contains("url") && citation.at("url").is_string()) {
        quoted["url"] = citation.at("url");
    }
    return quoted;
}

json nodeCenterJson(const json& node) {
    const json geometry = objectOrEmpty(node, "geometry");
    const double x = isFiniteNumber(geometry.value("x", json()))
                         ? geometry.at("x").get<double>()
                         : 0.0;
    const double y = isFiniteNumber(geometry.value("y", json()))
                         ? geometry.at("y").get<double>()
                         : 0.0;
    const double w = isFiniteNumber(geometry.value("w", json()))
                         ? geometry.at("w").get<double>()
                         : 0.0;
    const double h = isFiniteNumber(geometry.value("h", json()))
                         ? geometry.at("h").get<double>()
                         : 0.0;
    json center = json::object();
    center["x"] = jsonNumber(x + w / 2.0);
    center["y"] = jsonNumber(y + h / 2.0);
    return center;
}

struct Hop {
    std::string relationId;
    std::string kind;
    std::string from;
    std::string to;
    std::string neighborId;
};

bool kindAllowed(const std::vector<std::string>* kinds, const std::string& kind) {
    if (kinds == nullptr) {
        return true;
    }
    return std::find(kinds->begin(), kinds->end(), kind) != kinds->end();
}

std::vector<Hop> hops(
    const json& document,
    const std::string& nodeId,
    const std::string& direction,
    const std::vector<std::string>* kinds) {
    std::vector<Hop> out;
    for (const auto& relation : relationsOf(document)) {
        if (!relation.is_object()) {
            continue;
        }
        const std::string kind = asString(relation.value("kind", json()));
        if (!kindAllowed(kinds, kind)) {
            continue;
        }
        const std::string from = asString(relation.value("from", json()));
        const std::string to = asString(relation.value("to", json()));
        const std::string id = asString(relation.value("id", json()));
        if ((direction == "outbound" || direction == "both") && from == nodeId) {
            out.push_back({id, kind, from, to, to});
        }
        if ((direction == "inbound" || direction == "both") && to == nodeId) {
            out.push_back({id, kind, from, to, from});
        }
    }
    return out;
}

std::pair<std::vector<std::string>, std::vector<std::string>> reachable(
    const json& document,
    const std::string& startId,
    const std::string& direction,
    const std::vector<std::string>* kinds) {
    std::unordered_set<std::string> known;
    for (const auto& node : nodesOf(document)) {
        known.insert(asString(node.value("id", json())));
    }
    if (known.find(startId) == known.end()) {
        return {{}, {}};
    }
    std::unordered_set<std::string> seenNodes{startId};
    std::unordered_set<std::string> seenRelations;
    std::vector<std::string> nodeIds{startId};
    std::queue<std::string> queue;
    queue.push(startId);
    while (!queue.empty()) {
        const std::string current = queue.front();
        queue.pop();
        for (const auto& hop : hops(document, current, direction, kinds)) {
            seenRelations.insert(hop.relationId);
            if (seenNodes.count(hop.neighborId) || !known.count(hop.neighborId)) {
                continue;
            }
            seenNodes.insert(hop.neighborId);
            nodeIds.push_back(hop.neighborId);
            queue.push(hop.neighborId);
        }
    }
    std::vector<std::string> relationIds(seenRelations.begin(), seenRelations.end());
    // Insertion order is not preserved by unordered_set; TS reachable uses
    // first-seen order of relations during BFS. Recreate from walk.
    relationIds.clear();
    std::unordered_set<std::string> emitted;
    std::unordered_set<std::string> visited{startId};
    std::queue<std::string> again;
    again.push(startId);
    while (!again.empty()) {
        const std::string current = again.front();
        again.pop();
        for (const auto& hop : hops(document, current, direction, kinds)) {
            if (!emitted.count(hop.relationId)) {
                emitted.insert(hop.relationId);
                relationIds.push_back(hop.relationId);
            }
            if (!visited.count(hop.neighborId) && known.count(hop.neighborId)) {
                visited.insert(hop.neighborId);
                again.push(hop.neighborId);
            }
        }
    }
    return {nodeIds, relationIds};
}

void collectPaths(
    const json& document,
    const std::string& current,
    const std::string* endId,
    const std::string& direction,
    const std::vector<std::string>& kinds,
    std::vector<std::string>& nodePath,
    std::vector<std::string>& relationPath,
    std::unordered_set<std::string>& blocked,
    const std::unordered_set<std::string>& known,
    json& paths) {
    if (endId != nullptr) {
        if (current == *endId) {
            json path = json::object();
            path["nodeIds"] = nodePath;
            path["relationIds"] = relationPath;
            paths.push_back(std::move(path));
            return;
        }
    } else if (nodePath.size() > 1) {
        json path = json::object();
        path["nodeIds"] = nodePath;
        path["relationIds"] = relationPath;
        paths.push_back(std::move(path));
    }
    for (const auto& hop : hops(document, current, direction, &kinds)) {
        if (blocked.count(hop.neighborId) || !known.count(hop.neighborId)) {
            continue;
        }
        blocked.insert(hop.neighborId);
        nodePath.push_back(hop.neighborId);
        relationPath.push_back(hop.relationId);
        collectPaths(
            document,
            hop.neighborId,
            endId,
            direction,
            kinds,
            nodePath,
            relationPath,
            blocked,
            known,
            paths);
        nodePath.pop_back();
        relationPath.pop_back();
        blocked.erase(hop.neighborId);
    }
}

json simplePaths(
    const json& document,
    const std::string& startId,
    const std::string* endId,
    const std::string& direction,
    const std::vector<std::string>& kinds) {
    json paths = json::array();
    std::unordered_set<std::string> known;
    for (const auto& node : nodesOf(document)) {
        known.insert(asString(node.value("id", json())));
    }
    if (!known.count(startId)) {
        return paths;
    }
    std::vector<std::string> nodePath{startId};
    std::vector<std::string> relationPath;
    std::unordered_set<std::string> blocked{startId};
    collectPaths(
        document,
        startId,
        endId,
        direction,
        kinds,
        nodePath,
        relationPath,
        blocked,
        known,
        paths);
    if (endId == nullptr) {
        json filtered = json::array();
        for (const auto& path : paths) {
            if (path.at("nodeIds").size() > 1) {
                filtered.push_back(path);
            }
        }
        return filtered;
    }
    return paths;
}

json inboundRelationsJson(const json& document, const std::string& nodeId) {
    json out = json::array();
    for (const auto& relation : relationsOf(document)) {
        if (asString(relation.value("to", json())) == nodeId) {
            out.push_back(quotedRelation(relation));
        }
    }
    return out;
}

json outboundRelationsJson(const json& document, const std::string& nodeId) {
    json out = json::array();
    for (const auto& relation : relationsOf(document)) {
        if (asString(relation.value("from", json())) == nodeId) {
            out.push_back(quotedRelation(relation));
        }
    }
    return out;
}

json focusNodeIds(const json& document) {
    json out = json::array();
    for (const auto& node : nodesOf(document)) {
        if (isFocus(node)) {
            out.push_back(asString(node.value("id", json())));
        }
    }
    return out;
}

json deriveHornThread(const json& document, const std::string& focusNodeId) {
    std::unordered_set<std::string> nodeIds;
    auto byId = indexById(nodesOf(document));
    for (const auto& node : nodesOf(document)) {
        nodeIds.insert(asString(node.value("id", json())));
    }
    if (!nodeIds.count(focusNodeId)) {
        throw std::runtime_error("unknown Horn focus node: " + focusNodeId);
    }

    std::map<std::string, json> responsesByTarget;
    for (const auto& relation : relationsOf(document)) {
        const std::string kind = asString(relation.value("kind", json()));
        if (std::find(kDialectical.begin(), kDialectical.end(), kind) ==
            kDialectical.end()) {
            continue;
        }
        const std::string to = asString(relation.value("to", json()));
        json item = json::object();
        item["nodeId"] = asString(relation.value("from", json()));
        item["relationId"] = asString(relation.value("id", json()));
        responsesByTarget[to].push_back(std::move(item));
    }
    for (auto& entry : responsesByTarget) {
        auto& responses = entry.second;
        std::stable_sort(
            responses.begin(),
            responses.end(),
            [&](const json& left, const json& right) {
                const auto leftNode = byId.find(asString(left.value("nodeId", json())));
                const auto rightNode = byId.find(asString(right.value("nodeId", json())));
                const double ln = leftNode == byId.end() ? 0.0 : nodeNumber(leftNode->second);
                const double rn = rightNode == byId.end() ? 0.0 : nodeNumber(rightNode->second);
                return ln < rn;
            });
    }

    json steps = json::array();
    json first = json::object();
    first["nodeId"] = focusNodeId;
    first["depth"] = 0;
    steps.push_back(first);
    std::unordered_set<std::string> visited{focusNodeId};
    std::queue<std::pair<std::string, int>> queue;
    queue.push({focusNodeId, 0});
    while (!queue.empty()) {
        const auto current = queue.front();
        queue.pop();
        const auto found = responsesByTarget.find(current.first);
        if (found == responsesByTarget.end()) {
            continue;
        }
        for (const auto& response : found->second) {
            const std::string nodeId = asString(response.value("nodeId", json()));
            if (visited.count(nodeId)) {
                continue;
            }
            visited.insert(nodeId);
            json step = json::object();
            step["nodeId"] = nodeId;
            step["depth"] = current.second + 1;
            step["parentNodeId"] = current.first;
            step["relationId"] = asString(response.value("relationId", json()));
            steps.push_back(step);
            queue.push({nodeId, current.second + 1});
        }
    }

    json frontier = json::array();
    for (const auto& step : steps) {
        const std::string nodeId = asString(step.value("nodeId", json()));
        bool allUnvisited = true;
        const auto found = responsesByTarget.find(nodeId);
        if (found != responsesByTarget.end()) {
            for (const auto& response : found->second) {
                if (visited.count(asString(response.value("nodeId", json())))) {
                    allUnvisited = false;
                    break;
                }
            }
        }
        if (!allUnvisited) {
            continue;
        }
        if (nodeId != focusNodeId || steps.size() == 1) {
            frontier.push_back(nodeId);
        }
    }

    json thread = json::object();
    thread["focusNodeId"] = focusNodeId;
    thread["steps"] = steps;
    thread["frontierNodeIds"] = frontier;
    return thread;
}

json allFocusThreads(const json& document) {
    json threads = json::array();
    for (const auto& idValue : focusNodeIds(document)) {
        threads.push_back(deriveHornThread(document, asString(idValue)));
    }
    return threads;
}

const char* viewTitle(ProjectionView view) {
    switch (view) {
        case ProjectionView::Argument:
            return "Argument";
        case ProjectionView::Timeline:
            return "Timeline";
        case ProjectionView::Evidence:
            return "Evidence";
        case ProjectionView::Frontier:
            return "Frontier";
    }
    return "";
}

const char* viewDescription(ProjectionView view) {
    switch (view) {
        case ProjectionView::Argument:
            return "Semantic response topology; relation routes are intentionally abstracted.";
        case ProjectionView::Timeline:
            return "Chronological projection of dated claims without changing the Horn document.";
        case ProjectionView::Evidence:
            return "Derived source-to-claim network across mapped and cartographic provenance layers.";
        case ProjectionView::Frontier:
            return "Reader-facing dialogue threads from focus boxes to their current terminal arguments.";
    }
    return "";
}

json envelope(
    const json& document,
    ProjectionView view,
    const json& nodeIds,
    const json& relationIds,
    json analysis) {
    analysis["contract"] = "horn-analysis/0.1";
    analysis["description"] = viewDescription(view);
    analysis["runtime"] = std::string{RUNTIME_API_VERSION};
    analysis["title"] = viewTitle(view);
    analysis["view"] = std::string{projectionViewName(view)};
    json extensions = json::object();
    extensions["x-analysis"] = std::move(analysis);
    json projection = json::object();
    projection["id"] = asString(document.value("id", json())) + ":" +
                       std::string{projectionViewName(view)};
    projection["version"] = std::string{PROJECTION_CONTRACT};
    projection["source"] = {
        {"documentId", asString(document.value("id", json()))},
        {"documentVersion", "horn-document/0.1"},
    };
    projection["target"] = std::string{projectionViewName(view)};
    projection["nodes"] = nodeIds;
    projection["relations"] = relationIds;
    projection["extensions"] = std::move(extensions);
    return projection;
}

json projectArgumentView(const json& document) {
    json nodeIds = json::array();
    json placed = json::array();
    for (const auto& node : nodesOf(document)) {
        nodeIds.push_back(asString(node.value("id", json())));
        json item = json::object();
        item["center"] = nodeCenterJson(node);
        item["focus"] = isFocus(node);
        item["id"] = asString(node.value("id", json()));
        item["kind"] = asString(node.value("kind", json()));
        item["label"] = asString(node.value("label", json()));
        item["number"] = jsonNumberFrom(node.value("number", json()));
        placed.push_back(std::move(item));
    }
    json relationIds = json::array();
    json edges = json::array();
    for (const auto& relation : relationsOf(document)) {
        relationIds.push_back(asString(relation.value("id", json())));
        json edge = json::object();
        edge["from"] = asString(relation.value("from", json()));
        edge["id"] = asString(relation.value("id", json()));
        edge["kind"] = asString(relation.value("kind", json()));
        edge["label"] = asString(relation.value("label", json()));
        edge["to"] = asString(relation.value("to", json()));
        edges.push_back(std::move(edge));
    }
    json analysis = json::object();
    analysis["edges"] = std::move(edges);
    analysis["placed"] = std::move(placed);
    return envelope(document, ProjectionView::Argument, nodeIds, relationIds, std::move(analysis));
}

json projectTimelineView(const json& document) {
    struct Dated {
        json node;
        double year;
        double number;
    };
    std::vector<Dated> dated;
    for (const auto& node : nodesOf(document)) {
        if (node.contains("year") && isFiniteNumber(node.at("year"))) {
            dated.push_back({node, node.at("year").get<double>(), nodeNumber(node)});
        }
    }
    std::stable_sort(dated.begin(), dated.end(), [](const Dated& a, const Dated& b) {
        if (a.year != b.year) {
            return a.year < b.year;
        }
        return a.number < b.number;
    });
    json nodeIds = json::array();
    json datedNodes = json::array();
    for (const auto& item : dated) {
        const std::string id = asString(item.node.value("id", json()));
        nodeIds.push_back(id);
        json row = json::object();
        row["id"] = id;
        row["label"] = asString(item.node.value("label", json()));
        row["number"] = jsonNumber(item.number);
        row["year"] = jsonNumber(item.year);
        datedNodes.push_back(std::move(row));
    }
    json analysis = json::object();
    analysis["datedNodes"] = std::move(datedNodes);
    return envelope(
        document,
        ProjectionView::Timeline,
        nodeIds,
        json::array(),
        std::move(analysis));
}

json projectEvidenceView(const json& document) {
    auto citations = indexById(citationsOf(document));
    json citedIds = json::array();
    std::unordered_set<std::string> seen;
    for (const auto& node : nodesOf(document)) {
        for (const auto& citationIdValue : arrayOrEmpty(node, "citationIds")) {
            const std::string citationId = asString(citationIdValue);
            if (seen.count(citationId) || !citations.count(citationId)) {
                continue;
            }
            seen.insert(citationId);
            citedIds.push_back(citationId);
        }
    }
    json bindings = json::array();
    json claims = json::array();
    json nodeIds = json::array();
    for (const auto& node : nodesOf(document)) {
        const std::string nodeId = asString(node.value("id", json()));
        nodeIds.push_back(nodeId);
        json claim = json::object();
        claim["citationIds"] = arrayOrEmpty(node, "citationIds");
        claim["focus"] = isFocus(node);
        claim["id"] = nodeId;
        claim["label"] = asString(node.value("label", json()));
        claim["number"] = jsonNumberFrom(node.value("number", json()));
        claims.push_back(std::move(claim));
        for (const auto& citationIdValue : arrayOrEmpty(node, "citationIds")) {
            const std::string citationId = asString(citationIdValue);
            if (!citations.count(citationId)) {
                continue;
            }
            json binding = json::object();
            binding["citationId"] = citationId;
            binding["id"] = "evidence:" + citationId + ":" + nodeId;
            binding["nodeId"] = nodeId;
            bindings.push_back(std::move(binding));
        }
    }
    json citationRows = json::array();
    for (const auto& idValue : citedIds) {
        const std::string id = asString(idValue);
        const auto found = citations.find(id);
        json row = json::object();
        row["id"] = id;
        if (found != citations.end()) {
            row["layer"] = asString(found->second.value("layer", json()));
            row["short"] = asString(found->second.value("short", json()));
            row["year"] = jsonNumberFrom(found->second.value("year", json()));
        }
        citationRows.push_back(std::move(row));
    }
    json analysis = json::object();
    analysis["bindings"] = std::move(bindings);
    analysis["citations"] = std::move(citationRows);
    analysis["claims"] = std::move(claims);
    return envelope(
        document, ProjectionView::Evidence, nodeIds, json::array(), std::move(analysis));
}

json projectFrontierView(const json& document) {
    auto byId = indexById(nodesOf(document));
    json threads = allFocusThreads(document);
    std::unordered_map<std::string, json> placed;
    std::vector<std::string> placedOrder;
    json readingEdges = json::array();
    json relationIds = json::array();
    std::unordered_set<std::string> relationSeen;
    int lane = 0;
    for (const auto& thread : threads) {
        std::unordered_set<std::string> frontierIds;
        for (const auto& idValue : arrayOrEmpty(thread, "frontierNodeIds")) {
            frontierIds.insert(asString(idValue));
        }
        for (const auto& step : arrayOrEmpty(thread, "steps")) {
            const std::string nodeId = asString(step.value("nodeId", json()));
            if (!byId.count(nodeId) || placed.count(nodeId)) {
                continue;
            }
            const json& node = byId[nodeId];
            json item = json::object();
            item["depth"] = jsonNumberFrom(step.value("depth", json()));
            item["focus"] = isFocus(node);
            item["frontier"] = frontierIds.count(nodeId) > 0;
            item["id"] = nodeId;
            item["label"] = asString(node.value("label", json()));
            item["lane"] = lane;
            placed.emplace(nodeId, item);
            placedOrder.push_back(nodeId);
            lane += 1;
            if (step.contains("parentNodeId") && step.contains("relationId") &&
                !asString(step.value("parentNodeId", json())).empty() &&
                !asString(step.value("relationId", json())).empty()) {
                const std::string relationId = asString(step.value("relationId", json()));
                std::string kind = "response";
                for (const auto& relation : relationsOf(document)) {
                    if (asString(relation.value("id", json())) == relationId) {
                        kind = asString(relation.value("kind", json()));
                        break;
                    }
                }
                if (!relationSeen.count(relationId)) {
                    relationSeen.insert(relationId);
                    relationIds.push_back(relationId);
                }
                json edge = json::object();
                edge["from"] = asString(step.value("parentNodeId", json()));
                edge["id"] = "reading:" + relationId;
                edge["kind"] = kind;
                edge["relationId"] = relationId;
                edge["to"] = nodeId;
                readingEdges.push_back(std::move(edge));
            }
        }
    }
    json placedRows = json::array();
    for (const auto& id : placedOrder) {
        placedRows.push_back(placed[id]);
    }
    json threadRows = json::array();
    for (const auto& thread : threads) {
        json row = json::object();
        row["focusNodeId"] = thread.value("focusNodeId", json());
        row["frontierNodeIds"] = thread.value("frontierNodeIds", json::array());
        json steps = json::array();
        for (const auto& step : arrayOrEmpty(thread, "steps")) {
            json s = json::object();
            s["depth"] = jsonNumberFrom(step.value("depth", json()));
            s["nodeId"] = asString(step.value("nodeId", json()));
            if (step.contains("parentNodeId")) {
                s["parentNodeId"] = asString(step.value("parentNodeId", json()));
            }
            if (step.contains("relationId")) {
                s["relationId"] = asString(step.value("relationId", json()));
            }
            steps.push_back(std::move(s));
        }
        row["steps"] = std::move(steps);
        threadRows.push_back(std::move(row));
    }
    json analysis = json::object();
    analysis["placed"] = std::move(placedRows);
    analysis["readingEdges"] = std::move(readingEdges);
    analysis["threads"] = std::move(threadRows);
    json nodeIds = json::array();
    for (const auto& id : placedOrder) {
        nodeIds.push_back(id);
    }
    return envelope(
        document, ProjectionView::Frontier, nodeIds, relationIds, std::move(analysis));
}

json baseQueryResult(const json& document, const json& request) {
    json result = json::object();
    result["documentId"] = asString(document.value("id", json()));
    result["documentVersion"] = std::string{DOCUMENT_CONTRACT};
    result["op"] = asString(request.value("op", json()));
    result["runtime"] = std::string{RUNTIME_API_VERSION};
    result["version"] = std::string{QUERY_RESULT_CONTRACT};
    return result;
}

json queryError(const json& document, const json& request, const std::string& code, const std::string& message) {
    json result = baseQueryResult(document, request);
    result["error"] = {{"code", code}, {"message", message}};
    result["ok"] = false;
    return result;
}

std::string walkDirection(const std::string& direction) {
    if (direction == "inbound") {
        return "inbound";
    }
    if (direction == "semantic") {
        return "outbound";
    }
    if (direction == "outbound") {
        return "outbound";
    }
    if (direction == "reading") {
        return "inbound";
    }
    if (direction == "both") {
        return "both";
    }
    return "both";
}

std::vector<std::string> kindsFromRequest(const json& request, const std::vector<std::string>& fallback) {
    if (request.contains("kinds") && request.at("kinds").is_array()) {
        return stringArray(request.at("kinds"));
    }
    return fallback;
}

json cloneJson(const json& value) {
    return json::parse(value.dump());
}

json applyCounterfactual(const json& document, const json& request) {
    json suppress = objectOrEmpty(request, "suppress");
    std::unordered_set<std::string> suppressedNodes;
    std::unordered_set<std::string> suppressedRelations;
    for (const auto& id : arrayOrEmpty(suppress, "nodes")) {
        suppressedNodes.insert(asString(id));
    }
    for (const auto& id : arrayOrEmpty(suppress, "relations")) {
        suppressedRelations.insert(asString(id));
    }
    json suppressedBindings = arrayOrEmpty(suppress, "evidenceBindings");

    json copy = cloneJson(document);
    json nextNodes = json::array();
    for (const auto& node : nodesOf(copy)) {
        const std::string nodeId = asString(node.value("id", json()));
        if (suppressedNodes.count(nodeId)) {
            continue;
        }
        json next = cloneJson(node);
        json citationIds = json::array();
        for (const auto& citationIdValue : arrayOrEmpty(node, "citationIds")) {
            const std::string citationId = asString(citationIdValue);
            bool drop = false;
            for (const auto& bindingValue : suppressedBindings) {
                json binding = bindingValue.is_string()
                                   ? json{{"citationId", asString(bindingValue)}}
                                   : bindingValue;
                const bool hasCitation = binding.contains("citationId") &&
                                         !asString(binding.value("citationId", json())).empty();
                const bool hasNode = binding.contains("nodeId") &&
                                     !asString(binding.value("nodeId", json())).empty();
                if (hasCitation && asString(binding.value("citationId", json())) != citationId) {
                    continue;
                }
                if (hasNode && asString(binding.value("nodeId", json())) != nodeId) {
                    continue;
                }
                if (hasCitation || hasNode) {
                    drop = true;
                    break;
                }
            }
            if (!drop) {
                citationIds.push_back(citationId);
            }
        }
        next["citationIds"] = citationIds;
        nextNodes.push_back(std::move(next));
    }
    copy["nodes"] = nextNodes;
    std::unordered_set<std::string> remaining;
    for (const auto& node : nextNodes) {
        remaining.insert(asString(node.value("id", json())));
    }
    json nextRelations = json::array();
    for (const auto& relation : relationsOf(copy)) {
        const std::string id = asString(relation.value("id", json()));
        const std::string from = asString(relation.value("from", json()));
        const std::string to = asString(relation.value("to", json()));
        if (suppressedRelations.count(id) || !remaining.count(from) || !remaining.count(to)) {
            continue;
        }
        nextRelations.push_back(relation);
    }
    copy["relations"] = nextRelations;
    json nextPath = json::array();
    for (const auto& idValue : arrayOrEmpty(copy, "readingPath")) {
        if (remaining.count(asString(idValue))) {
            nextPath.push_back(idValue);
        }
    }
    copy["readingPath"] = nextPath;
    return copy;
}

json stableFingerprintPayload(const json& snapshot) {
    json graph = json::object();
    json dependencyGraph = objectOrEmpty(snapshot, "dependencyGraph");
    std::vector<std::string> keys;
    for (auto it = dependencyGraph.begin(); it != dependencyGraph.end(); ++it) {
        keys.push_back(it.key());
    }
    std::sort(keys.begin(), keys.end());
    for (const auto& key : keys) {
        json deps = dependencyGraph.at(key);
        std::vector<std::string> items = stringArray(deps);
        std::sort(items.begin(), items.end());
        graph[key] = items;
    }
    json payload = json::object();
    payload["components"] = snapshot.value("components", json::object());
    payload["dependencyGraph"] = graph;
    return payload;
}

std::string fingerprintEvidence(const json& snapshot) {
    return sha256Prefixed(dumpCompactSorted(stableFingerprintPayload(snapshot)));
}

json bindingsArray(const json& bindingsJson) {
    if (bindingsJson.is_array()) {
        return bindingsJson;
    }
    return arrayOrEmpty(bindingsJson, "bindings");
}

json invalidateChangedEvidence(const json& snapshot, const json& bindings) {
    const std::string observed = fingerprintEvidence(snapshot);
    json out = json::array();
    for (const auto& binding : bindingsArray(bindings)) {
        const std::string expected = asString(binding.value("expectedFingerprint", json()));
        if (expected == observed) {
            continue;
        }
        json item = json::object();
        item["evidenceId"] = asString(binding.value("evidenceId", json()));
        item["expectedFingerprint"] = expected;
        item["observedFingerprint"] = observed;
        item["staleNodeIds"] = arrayOrEmpty(binding, "nodeIds");
        item["rationale"] = asString(binding.value("rationale", json()));
        out.push_back(std::move(item));
    }
    return out;
}

json runQueryJson(const json& document, const json& request);

json projectionPresence(const json& document, const std::string& nodeId) {
    const json argument = projectArgumentView(document);
    const json timeline = projectTimelineView(document);
    const json evidence = projectEvidenceView(document);
    const json frontier = projectFrontierView(document);
    json frontierFacts = json::array();
    for (const auto& thread : allFocusThreads(document)) {
        bool inThread = false;
        for (const auto& step : arrayOrEmpty(thread, "steps")) {
            if (asString(step.value("nodeId", json())) == nodeId) {
                inThread = true;
                break;
            }
        }
        if (!inThread) {
            continue;
        }
        bool isFrontier = false;
        for (const auto& idValue : arrayOrEmpty(thread, "frontierNodeIds")) {
            if (asString(idValue) == nodeId) {
                isFrontier = true;
                break;
            }
        }
        json fact = json::object();
        fact["focusNodeId"] = asString(thread.value("focusNodeId", json()));
        fact["frontier"] = isFrontier;
        frontierFacts.push_back(std::move(fact));
    }
    auto containsId = [&](const json& projection) {
        for (const auto& idValue : arrayOrEmpty(projection, "nodes")) {
            if (asString(idValue) == nodeId) {
                return true;
            }
        }
        return false;
    };
    json out = json::object();
    out["argument"] = containsId(argument);
    out["evidence"] = containsId(evidence);
    out["frontier"] = frontierFacts;
    out["inFrontierProjection"] = containsId(frontier);
    out["timeline"] = containsId(timeline);
    return out;
}

json staleForNodes(const json& support, const std::vector<std::string>& nodeIds) {
    json out = json::array();
    if (!support.contains("evidence") || !support.contains("bindings") ||
        support.at("evidence").is_null() || support.at("bindings").is_null()) {
        return out;
    }
    std::unordered_set<std::string> wanted(nodeIds.begin(), nodeIds.end());
    for (const auto& item : invalidateChangedEvidence(support.at("evidence"), support.at("bindings"))) {
        bool hit = false;
        json stale = json::array();
        std::vector<std::string> ids = stringArray(item.value("staleNodeIds", json::array()));
        std::sort(ids.begin(), ids.end());
        for (const auto& id : ids) {
            stale.push_back(id);
            if (wanted.count(id)) {
                hit = true;
            }
        }
        if (!hit) {
            continue;
        }
        json row = json::object();
        row["evidenceId"] = item.value("evidenceId", json());
        row["expectedFingerprint"] = item.value("expectedFingerprint", json());
        row["observedFingerprint"] = item.value("observedFingerprint", json());
        row["rationale"] = item.value("rationale", json());
        row["staleNodeIds"] = stale;
        out.push_back(std::move(row));
    }
    return out;
}

json extractionContributions(const std::string& identity, const json& support) {
    json out = json::array();
    if (!support.contains("extraction") || !support.at("extraction").is_object()) {
        return out;
    }
    for (const auto& decision : arrayOrEmpty(support.at("extraction"), "decisions")) {
        if (asString(decision.value("claimId", json())) == identity) {
            json row = json::object();
            row["candidateId"] = asString(decision.value("candidateId", json()));
            row["claimId"] = asString(decision.value("claimId", json()));
            row["decision"] = asString(decision.value("decision", json()));
            row["reason"] = asString(decision.value("reason", json()));
            out.push_back(std::move(row));
        }
    }
    return out;
}

json explainNode(const json& document, const std::string& identity, const json& support) {
    auto nodes = indexById(nodesOf(document));
    auto citations = indexById(citationsOf(document));
    const json& node = nodes.at(identity);
    json warrantRoads = json::array();
    for (const auto& relation : relationsOf(document)) {
        if (asString(relation.value("kind", json())) == "warrants" &&
            (asString(relation.value("from", json())) == identity ||
             asString(relation.value("to", json())) == identity)) {
            warrantRoads.push_back(quotedRelation(relation));
        }
    }
    json licensed = json::array();
    json semantic = json();
    if (support.contains("argument") && support.at("argument").is_object()) {
        const json& argument = support.at("argument");
        for (const auto& relation : arrayOrEmpty(argument, "relations")) {
            if (asString(relation.value("kind", json())) == "supports" &&
                (asString(relation.value("from", json())) == identity ||
                 asString(relation.value("to", json())) == identity ||
                 asString(relation.value("warrantClaimId", json())) == identity)) {
                json row = json::object();
                row["from"] = asString(relation.value("from", json()));
                row["id"] = asString(relation.value("id", json()));
                row["to"] = asString(relation.value("to", json()));
                if (relation.contains("warrantClaimId")) {
                    row["warrantClaimId"] = relation.value("warrantClaimId", json());
                }
                licensed.push_back(std::move(row));
            }
        }
        for (const auto& claim : arrayOrEmpty(argument, "claims")) {
            if (asString(claim.value("id", json())) == identity) {
                semantic = json::object();
                semantic["origin"] = claim.contains("origin") ? claim.value("origin", json()) : json();
                semantic["role"] = asString(claim.value("role", json()));
                semantic["sourceIds"] = arrayOrEmpty(claim, "sourceIds");
                semantic["statement"] = asString(claim.value("statement", json()));
                break;
            }
        }
    }
    json bindings = json::array();
    if (support.contains("bindings") && support.at("bindings").is_array()) {
        for (const auto& binding : support.at("bindings")) {
            bool hit = false;
            for (const auto& idValue : arrayOrEmpty(binding, "nodeIds")) {
                if (asString(idValue) == identity) {
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                continue;
            }
            json row = json::object();
            row["evidenceId"] = asString(binding.value("evidenceId", json()));
            row["expectedFingerprint"] = asString(binding.value("expectedFingerprint", json()));
            row["rationale"] = asString(binding.value("rationale", json()));
            bindings.push_back(std::move(row));
        }
    }
    json sources = json::array();
    for (const auto& idValue : arrayOrEmpty(node, "citationIds")) {
        const auto found = citations.find(asString(idValue));
        if (found != citations.end()) {
            sources.push_back(quotedCitation(found->second));
        }
    }
    json origin = json::object();
    origin["after"] = document.contains("after") ? document.value("after", json()) : json();
    origin["documentAuthority"] = asString(document.value("authority", json()));
    origin["nodeOrigin"] = asString(node.value("origin", json()));

    json result = json::object();
    result["documentId"] = asString(document.value("id", json()));
    result["documentVersion"] = std::string{DOCUMENT_CONTRACT};
    result["identity"] = identity;
    result["runtime"] = std::string{RUNTIME_API_VERSION};
    result["version"] = std::string{EXPLANATION_CONTRACT};
    result["evidence"] = {
        {"bindings", bindings},
        {"citationIds", arrayOrEmpty(node, "citationIds")},
    };
    result["extraction"] = extractionContributions(identity, support);
    result["kind"] = "node";
    result["object"] = quotedNode(node);
    result["ok"] = true;
    result["origin"] = origin;
    result["projections"] = projectionPresence(document, identity);
    result["relations"] = {
        {"inbound", inboundRelationsJson(document, identity)},
        {"outbound", outboundRelationsJson(document, identity)},
    };
    result["semantic"] = semantic.is_null() ? json() : semantic;
    result["sources"] = sources;
    result["stale"] = staleForNodes(support, {identity});
    result["warrants"] = {{"licensedSupports", licensed}, {"roads", warrantRoads}};
    return result;
}

json addedRemoved(const std::vector<std::string>& before, const std::vector<std::string>& afterIds) {
    std::unordered_set<std::string> beforeSet(before.begin(), before.end());
    std::unordered_set<std::string> afterSet(afterIds.begin(), afterIds.end());
    json added = json::array();
    json removed = json::array();
    std::vector<std::string> addedIds;
    std::vector<std::string> removedIds;
    for (const auto& id : afterSet) {
        if (!beforeSet.count(id)) {
            addedIds.push_back(id);
        }
    }
    for (const auto& id : beforeSet) {
        if (!afterSet.count(id)) {
            removedIds.push_back(id);
        }
    }
    std::sort(addedIds.begin(), addedIds.end());
    std::sort(removedIds.begin(), removedIds.end());
    for (const auto& id : addedIds) {
        added.push_back(id);
    }
    for (const auto& id : removedIds) {
        removed.push_back(id);
    }
    return json{{"added", added}, {"removed", removed}};
}

json scalarChanges(
    const std::string& identity,
    const json& before,
    const json& after,
    const std::vector<std::string>& fields) {
    json changes = json::array();
    for (const auto& field : fields) {
        json left = before.contains(field) ? before.at(field) : json();
        json right = after.contains(field) ? after.at(field) : json();
        if (dumpCompactSorted(left) != dumpCompactSorted(right)) {
            json change = json::object();
            change["after"] = right.is_null() ? json() : right;
            change["before"] = left.is_null() ? json() : left;
            change["field"] = field;
            change["id"] = identity;
            changes.push_back(std::move(change));
        }
    }
    return changes;
}

void appendAll(json& target, const json& extra) {
    for (const auto& item : extra) {
        target.push_back(item);
    }
}

json idsOf(const json& items) {
    json out = json::array();
    for (const auto& item : items) {
        out.push_back(asString(item.value("id", json())));
    }
    return out;
}

std::vector<std::string> idList(const json& items) {
    std::vector<std::string> out;
    for (const auto& item : items) {
        if (item.is_string()) {
            out.push_back(asString(item));
        } else if (item.is_object()) {
            out.push_back(asString(item.value("id", json())));
        }
    }
    return out;
}

json runQueryJson(const json& document, const json& request) {
    const std::string version = asString(request.value("version", json()));
    if (!version.empty() && version != std::string{QUERY_CONTRACT}) {
        return queryError(
            document, request, "E_QUERY_VERSION", "unsupported query contract " + version);
    }
    const std::string op = asString(request.value("op", json()));
    auto nodes = indexById(nodesOf(document));
    auto relations = indexById(relationsOf(document));

    auto requireNode = [&](const std::string& id) -> json {
        if (id.empty()) {
            return queryError(document, request, "E_MISSING_ID", op + " requires id");
        }
        if (!nodes.count(id)) {
            return queryError(document, request, "E_NODE_NOT_FOUND", "unknown node " + id);
        }
        return json();
    };

    if (op == "node-lookup") {
        const std::string id = asString(request.value("id", json()));
        json err = requireNode(id);
        if (!err.is_null()) {
            if (id.empty()) {
                return queryError(document, request, "E_MISSING_ID", "node lookup requires id");
            }
            return err;
        }
        json result = baseQueryResult(document, request);
        result["node"] = quotedNode(nodes.at(id));
        result["ok"] = true;
        return result;
    }
    if (op == "relation-lookup") {
        const std::string id = asString(request.value("id", json()));
        if (id.empty()) {
            return queryError(document, request, "E_MISSING_ID", "relation lookup requires id");
        }
        if (!relations.count(id)) {
            return queryError(
                document, request, "E_RELATION_NOT_FOUND", "unknown relation " + id);
        }
        json result = baseQueryResult(document, request);
        result["ok"] = true;
        result["relation"] = quotedRelation(relations.at(id));
        return result;
    }
    if (op == "neighborhood") {
        const std::string id = asString(request.value("id", json()));
        if (id.empty()) {
            return queryError(document, request, "E_MISSING_ID", "neighborhood requires id");
        }
        json err = requireNode(id);
        if (!err.is_null()) {
            return err;
        }
        const std::string direction = asString(request.value("direction", json()));
        json result = baseQueryResult(document, request);
        result["inbound"] = (direction == "outbound") ? json::array()
                                                      : inboundRelationsJson(document, id);
        result["nodeId"] = id;
        result["ok"] = true;
        result["outbound"] = (direction == "inbound") ? json::array()
                                                      : outboundRelationsJson(document, id);
        return result;
    }
    if (op == "reachable" || op == "ancestors" || op == "descendants") {
        const std::string id = asString(request.value("id", json()));
        if (id.empty()) {
            return queryError(document, request, "E_MISSING_ID", "reachable requires id");
        }
        json err = requireNode(id);
        if (!err.is_null()) {
            return err;
        }
        std::string direction = asString(request.value("direction", json()));
        if (op == "ancestors") {
            direction = "semantic";
        } else if (op == "descendants") {
            direction = "reading";
        }
        auto kinds = kindsFromRequest(request, {});
        const std::vector<std::string>* kindsPtr = request.contains("kinds") ? &kinds : nullptr;
        auto walked = reachable(document, id, walkDirection(direction), kindsPtr);
        json result = baseQueryResult(document, request);
        result["nodeIds"] = walked.first;
        result["ok"] = true;
        result["relationIds"] = walked.second;
        return result;
    }
    if (op == "support-path" || op == "challenge-path") {
        std::string start = asString(request.value("id", json()));
        if (start.empty()) {
            start = asString(request.value("from", json()));
        }
        if (start.empty()) {
            return queryError(document, request, "E_MISSING_ID", op + " requires id or from");
        }
        json err = requireNode(start);
        if (!err.is_null()) {
            if (asString(request.value("id", json())).empty() &&
                asString(request.value("from", json())).empty()) {
                return queryError(document, request, "E_MISSING_ID", op + " requires id or from");
            }
            return queryError(document, request, "E_NODE_NOT_FOUND", "unknown node " + start);
        }
        auto kinds = kindsFromRequest(request, op == "support-path" ? kSupport : kChallenge);
        json inbound = json::array();
        json outbound = json::array();
        for (const auto& hop : hops(document, start, "inbound", &kinds)) {
            inbound.push_back(
                {{"from", hop.from}, {"kind", hop.kind}, {"relationId", hop.relationId}});
        }
        for (const auto& hop : hops(document, start, "outbound", &kinds)) {
            outbound.push_back(
                {{"kind", hop.kind}, {"relationId", hop.relationId}, {"to", hop.to}});
        }
        auto closure = reachable(document, start, "both", &kinds);
        json paths = json::array();
        if (request.contains("to") && request.at("to").is_string()) {
            const std::string to = asString(request.at("to"));
            paths = simplePaths(document, start, &to, "both", kinds);
        }
        json result = baseQueryResult(document, request);
        result["inbound"] = inbound;
        result["nodeId"] = start;
        result["ok"] = true;
        result["outbound"] = outbound;
        result["paths"] = paths;
        result["reachable"] = {{"nodeIds", closure.first}, {"relationIds", closure.second}};
        return result;
    }
    if (op == "frontier") {
        try {
            json threads = json::array();
            if (request.contains("id") && !asString(request.value("id", json())).empty()) {
                json thread = deriveHornThread(document, asString(request.value("id", json())));
                json row = json::object();
                row["focusNodeId"] = thread.value("focusNodeId", json());
                row["frontierNodeIds"] = thread.value("frontierNodeIds", json::array());
                json steps = json::array();
                for (const auto& step : arrayOrEmpty(thread, "steps")) {
                    json s = json::object();
                    s["depth"] = jsonNumberFrom(step.value("depth", json()));
                    s["nodeId"] = asString(step.value("nodeId", json()));
                    if (step.contains("parentNodeId")) {
                        s["parentNodeId"] = asString(step.value("parentNodeId", json()));
                    }
                    if (step.contains("relationId")) {
                        s["relationId"] = asString(step.value("relationId", json()));
                    }
                    steps.push_back(std::move(s));
                }
                row["steps"] = steps;
                threads.push_back(row);
            } else {
                for (const auto& thread : allFocusThreads(document)) {
                    json row = json::object();
                    row["focusNodeId"] = thread.value("focusNodeId", json());
                    row["frontierNodeIds"] = thread.value("frontierNodeIds", json::array());
                    json steps = json::array();
                    for (const auto& step : arrayOrEmpty(thread, "steps")) {
                        json s = json::object();
                        s["depth"] = jsonNumberFrom(step.value("depth", json()));
                        s["nodeId"] = asString(step.value("nodeId", json()));
                        if (step.contains("parentNodeId")) {
                            s["parentNodeId"] = asString(step.value("parentNodeId", json()));
                        }
                        if (step.contains("relationId")) {
                            s["relationId"] = asString(step.value("relationId", json()));
                        }
                        steps.push_back(std::move(s));
                    }
                    row["steps"] = steps;
                    threads.push_back(row);
                }
            }
            json result = baseQueryResult(document, request);
            result["ok"] = true;
            result["threads"] = threads;
            return result;
        } catch (const std::exception& error) {
            return queryError(document, request, "E_NODE_NOT_FOUND", error.what());
        }
    }
    if (op == "evidence-bound") {
        auto citations = indexById(citationsOf(document));
        json bound = json::array();
        std::map<std::string, json> byCitation;
        for (const auto& node : nodesOf(document)) {
            json citationIds = arrayOrEmpty(node, "citationIds");
            if (!citationIds.empty()) {
                bound.push_back(
                    {{"citationIds", citationIds},
                     {"nodeId", asString(node.value("id", json()))}});
            }
            for (const auto& citationIdValue : citationIds) {
                const std::string citationId = asString(citationIdValue);
                if (!citations.count(citationId)) {
                    continue;
                }
                byCitation[citationId].push_back(asString(node.value("id", json())));
            }
        }
        json citationsOut = json::array();
        for (const auto& entry : byCitation) {
            citationsOut.push_back({{"citationId", entry.first}, {"nodeIds", entry.second}});
        }
        json result = baseQueryResult(document, request);
        result["citations"] = citationsOut;
        result["nodes"] = bound;
        result["ok"] = true;
        return result;
    }
    if (op == "provenance-trace") {
        const std::string id = asString(request.value("id", json()));
        if (id.empty()) {
            return queryError(
                document, request, "E_MISSING_ID", "provenance-trace requires id");
        }
        json err = requireNode(id);
        if (!err.is_null()) {
            return err;
        }
        auto citations = indexById(citationsOf(document));
        json cited = json::array();
        for (const auto& citationIdValue : arrayOrEmpty(nodes.at(id), "citationIds")) {
            const auto found = citations.find(asString(citationIdValue));
            if (found != citations.end()) {
                cited.push_back(quotedCitation(found->second));
            }
        }
        json result = baseQueryResult(document, request);
        result["citations"] = cited;
        result["inbound"] = inboundRelationsJson(document, id);
        result["node"] = quotedNode(nodes.at(id));
        result["ok"] = true;
        result["outbound"] = outboundRelationsJson(document, id);
        return result;
    }
    if (op == "orphans") {
        std::unordered_set<std::string> referencedNodes;
        for (const auto& relation : relationsOf(document)) {
            referencedNodes.insert(asString(relation.value("from", json())));
            referencedNodes.insert(asString(relation.value("to", json())));
        }
        std::unordered_set<std::string> referencedCitations;
        for (const auto& node : nodesOf(document)) {
            for (const auto& citationIdValue : arrayOrEmpty(node, "citationIds")) {
                referencedCitations.insert(asString(citationIdValue));
            }
        }
        std::vector<std::string> unreferencedNodes;
        for (const auto& node : nodesOf(document)) {
            const std::string id = asString(node.value("id", json()));
            if (!referencedNodes.count(id)) {
                unreferencedNodes.push_back(id);
            }
        }
        std::vector<std::string> unreferencedCitations;
        for (const auto& citation : citationsOf(document)) {
            const std::string id = asString(citation.value("id", json()));
            if (!referencedCitations.count(id)) {
                unreferencedCitations.push_back(id);
            }
        }
        std::sort(unreferencedNodes.begin(), unreferencedNodes.end());
        std::sort(unreferencedCitations.begin(), unreferencedCitations.end());
        json result = baseQueryResult(document, request);
        result["ok"] = true;
        result["unreferencedCitations"] = unreferencedCitations;
        result["unreferencedNodes"] = unreferencedNodes;
        return result;
    }
    if (op == "counterfactual") {
        const json beforeFrontier = projectFrontierView(document);
        const json hypothetical = applyCounterfactual(document, request);
        json remainingNodeIds = idsOf(nodesOf(hypothetical));
        json remainingRelationIds = idsOf(relationsOf(hypothetical));
        json focusSeeds = json::array();
        for (const auto& node : nodesOf(hypothetical)) {
            if (isFocus(node)) {
                focusSeeds.push_back(asString(node.value("id", json())));
            }
        }
        if (focusSeeds.empty() && !remainingNodeIds.empty()) {
            focusSeeds.push_back(remainingNodeIds.at(0));
        }
        std::vector<std::string> reachableNodes;
        std::unordered_set<std::string> reachableNodeSet;
        std::unordered_set<std::string> reachableRelationSet;
        for (const auto& seedValue : focusSeeds) {
            auto walked = reachable(hypothetical, asString(seedValue), "both", nullptr);
            for (const auto& id : walked.first) {
                if (reachableNodeSet.insert(id).second) {
                    reachableNodes.push_back(id);
                }
            }
            for (const auto& id : walked.second) {
                reachableRelationSet.insert(id);
            }
        }
        json disconnected = json::array();
        for (const auto& idValue : remainingNodeIds) {
            if (!reachableNodeSet.count(asString(idValue))) {
                disconnected.push_back(idValue);
            }
        }
        const json afterFrontier = projectFrontierView(hypothetical);
        json beforeFrontierIds = json::array();
        json afterFrontierIds = json::array();
        for (const auto& item :
             arrayOrEmpty(objectOrEmpty(objectOrEmpty(beforeFrontier, "extensions"), "x-analysis"), "placed")) {
            beforeFrontierIds.push_back(asString(item.value("id", json())));
        }
        for (const auto& item :
             arrayOrEmpty(objectOrEmpty(objectOrEmpty(afterFrontier, "extensions"), "x-analysis"), "placed")) {
            afterFrontierIds.push_back(asString(item.value("id", json())));
        }
        json beforeSupport = json::array();
        json afterSupport = json::array();
        for (const auto& relation : relationsOf(document)) {
            const std::string kind = asString(relation.value("kind", json()));
            if (kind == "supports" || kind == "warrants") {
                beforeSupport.push_back(asString(relation.value("id", json())));
            }
        }
        for (const auto& relation : relationsOf(hypothetical)) {
            const std::string kind = asString(relation.value("kind", json()));
            if (kind == "supports" || kind == "warrants") {
                afterSupport.push_back(asString(relation.value("id", json())));
            }
        }
        json suppress = objectOrEmpty(request, "suppress");
        std::vector<std::string> suppressedNodes = stringArray(arrayOrEmpty(suppress, "nodes"));
        std::vector<std::string> suppressedRelations = stringArray(arrayOrEmpty(suppress, "relations"));
        std::sort(suppressedNodes.begin(), suppressedNodes.end());
        std::sort(suppressedRelations.begin(), suppressedRelations.end());
        std::vector<std::string> reachableRelationIds(
            reachableRelationSet.begin(), reachableRelationSet.end());
        std::sort(reachableRelationIds.begin(), reachableRelationIds.end());

        json result = baseQueryResult(document, request);
        result["after"] = {
            {"frontierNodeIds", afterFrontierIds},
            {"nodeIds", remainingNodeIds},
            {"relationIds", remainingRelationIds},
            {"supportRelationIds", afterSupport},
        };
        result["before"] = {
            {"frontierNodeIds", beforeFrontierIds},
            {"nodeIds", idsOf(nodesOf(document))},
            {"relationIds", idsOf(relationsOf(document))},
            {"supportRelationIds", beforeSupport},
        };
        result["disconnectedIds"] = disconnected;
        result["ok"] = true;
        result["reachableArgument"] = {
            {"nodeIds", reachableNodes},
            {"relationIds", reachableRelationIds},
        };
        result["sourceMutated"] = false;
        result["suppressed"] = {
            {"evidenceBindings", arrayOrEmpty(suppress, "evidenceBindings")},
            {"nodes", suppressedNodes},
            {"relations", suppressedRelations},
        };
        return result;
    }
    return queryError(document, request, "E_UNKNOWN_OP", "unknown query op " + op);
}

json assessImpactJson(const json& document, const json& evidence, const json& bindings) {
    const std::string observed = fingerprintEvidence(evidence);
    json invalidations = invalidateChangedEvidence(evidence, bindings);
    json changed = json::array();
    std::vector<std::string> directly;
    std::unordered_set<std::string> directlySet;
    for (const auto& item : invalidations) {
        json row = json::object();
        row["evidenceId"] = item.value("evidenceId", json());
        row["expectedFingerprint"] = item.value("expectedFingerprint", json());
        row["observedFingerprint"] = item.value("observedFingerprint", json());
        row["rationale"] = item.value("rationale", json());
        changed.push_back(std::move(row));
        for (const auto& idValue : arrayOrEmpty(item, "staleNodeIds")) {
            const std::string id = asString(idValue);
            if (directlySet.insert(id).second) {
                directly.push_back(id);
            }
        }
    }
    std::sort(directly.begin(), directly.end());
    json unchanged = json::array();
    for (const auto& binding : bindingsArray(bindings)) {
        if (asString(binding.value("expectedFingerprint", json())) == observed) {
            unchanged.push_back(
                {{"evidenceId", asString(binding.value("evidenceId", json()))},
                 {"fingerprint", observed}});
        }
    }
    std::unordered_set<std::string> transitively(directly.begin(), directly.end());
    std::unordered_set<std::string> transitiveRelations;
    for (const auto& nodeId : directly) {
        auto walked = reachable(document, nodeId, "both", nullptr);
        for (const auto& id : walked.first) {
            transitively.insert(id);
        }
        for (const auto& id : walked.second) {
            transitiveRelations.insert(id);
        }
    }
    std::vector<std::string> transitivelyAffected;
    std::vector<std::string> affected;
    for (const auto& id : transitively) {
        affected.push_back(id);
        if (!directlySet.count(id)) {
            transitivelyAffected.push_back(id);
        }
    }
    std::sort(transitivelyAffected.begin(), transitivelyAffected.end());
    std::sort(affected.begin(), affected.end());
    std::vector<std::string> unaffected;
    for (const auto& node : nodesOf(document)) {
        const std::string id = asString(node.value("id", json()));
        if (!transitively.count(id)) {
            unaffected.push_back(id);
        }
    }
    std::sort(unaffected.begin(), unaffected.end());
    std::vector<std::string> transitiveRelationIds(
        transitiveRelations.begin(), transitiveRelations.end());
    std::sort(transitiveRelationIds.begin(), transitiveRelationIds.end());

    auto inSet = [&](const json& projection) {
        json out = json::array();
        std::vector<std::string> ids;
        for (const auto& idValue : arrayOrEmpty(projection, "nodes")) {
            const std::string id = asString(idValue);
            if (transitively.count(id)) {
                ids.push_back(id);
            }
        }
        std::sort(ids.begin(), ids.end());
        for (const auto& id : ids) {
            out.push_back(id);
        }
        return out;
    };

    json report = json::object();
    report["affectedIdentities"] = affected;
    report["affectedProjections"] = {
        {"argument", inSet(projectArgumentView(document))},
        {"evidence", inSet(projectEvidenceView(document))},
        {"frontier", inSet(projectFrontierView(document))},
        {"timeline", inSet(projectTimelineView(document))},
    };
    report["changedFingerprints"] = changed;
    report["directlyStale"] = directly;
    report["documentId"] = asString(document.value("id", json()));
    report["documentVersion"] = std::string{DOCUMENT_CONTRACT};
    report["mutatesSource"] = false;
    report["observedFingerprint"] = observed;
    report["runtime"] = std::string{RUNTIME_API_VERSION};
    report["transitivelyAffected"] = transitivelyAffected;
    report["transitivelyAffectedRelations"] = transitiveRelationIds;
    report["unaffected"] = unaffected;
    report["unchangedFingerprints"] = unchanged;
    report["version"] = std::string{IMPACT_CONTRACT};
    return report;
}

json nodeRecord(const json& node) {
    json rec = json::object();
    rec["author"] = node.contains("author") ? node.at("author") : json();
    rec["authorShort"] = node.contains("authorShort") ? node.at("authorShort") : json();
    rec["citationIds"] = arrayOrEmpty(node, "citationIds");
    rec["focus"] = isFocus(node);
    rec["geometry"] = node.contains("geometry") ? node.at("geometry") : json();
    rec["kind"] = node.value("kind", json());
    rec["label"] = node.value("label", json());
    rec["notes"] = node.contains("notes") ? node.at("notes") : json();
    rec["number"] = node.value("number", json());
    rec["origin"] = node.value("origin", json());
    rec["text"] = node.value("text", json());
    rec["year"] = node.contains("year") ? node.at("year") : json();
    return rec;
}

json relationRecord(const json& relation) {
    json rec = json::object();
    rec["from"] = relation.value("from", json());
    rec["kind"] = relation.value("kind", json());
    rec["label"] = relation.value("label", json());
    rec["route"] = relation.contains("route") ? relation.at("route") : json();
    rec["to"] = relation.value("to", json());
    return rec;
}

json diffDocumentsJson(const json& before, const json& after) {
    auto beforeNodes = indexById(nodesOf(before));
    auto afterNodes = indexById(nodesOf(after));
    auto beforeRelations = indexById(relationsOf(before));
    auto afterRelations = indexById(relationsOf(after));
    auto beforeCitations = indexById(citationsOf(before));
    auto afterCitations = indexById(citationsOf(after));
    auto beforeRegions = indexById(regionsOf(before));
    auto afterRegions = indexById(regionsOf(after));

    json content = json::array();
    json topologyChanges = json::array();
    json evidenceBindings = json::array();
    json provenance = json::array();
    json authoredGeometry = json::array();

    appendAll(content, scalarChanges("document", before, after, {"title", "subtitle", "issueQuestion", "rights", "unitSize"}));
    appendAll(provenance, scalarChanges("document", before, after, {"authority", "vocabulary", "after"}));
    appendAll(authoredGeometry, scalarChanges("document", before, after, {"canvas"}));

    auto reading = addedRemoved(
        stringArray(arrayOrEmpty(before, "readingPath")),
        stringArray(arrayOrEmpty(after, "readingPath")));
    if (!reading.at("added").empty() || !reading.at("removed").empty()) {
        json change = json::object();
        change["after"] = arrayOrEmpty(after, "readingPath");
        change["before"] = arrayOrEmpty(before, "readingPath");
        change["field"] = "readingPath";
        change["id"] = "document";
        topologyChanges.push_back(std::move(change));
    }

    for (const auto& node : nodesOf(after)) {
        const std::string id = asString(node.value("id", json()));
        if (!beforeNodes.count(id) || !afterNodes.count(id)) {
            continue;
        }
        json left = nodeRecord(beforeNodes.at(id));
        json right = nodeRecord(afterNodes.at(id));
        appendAll(content, scalarChanges(id, left, right, {"label", "text", "kind", "number", "focus", "author", "authorShort", "year", "notes"}));
        appendAll(provenance, scalarChanges(id, left, right, {"origin"}));
        appendAll(evidenceBindings, scalarChanges(id, left, right, {"citationIds"}));
        appendAll(authoredGeometry, scalarChanges(id, left, right, {"geometry"}));
    }
    for (const auto& relation : relationsOf(after)) {
        const std::string id = asString(relation.value("id", json()));
        if (!beforeRelations.count(id) || !afterRelations.count(id)) {
            continue;
        }
        json left = relationRecord(beforeRelations.at(id));
        json right = relationRecord(afterRelations.at(id));
        appendAll(topologyChanges, scalarChanges(id, left, right, {"from", "to", "kind"}));
        appendAll(content, scalarChanges(id, left, right, {"label"}));
        appendAll(authoredGeometry, scalarChanges(id, left, right, {"route"}));
    }
    for (const auto& citation : citationsOf(after)) {
        const std::string id = asString(citation.value("id", json()));
        if (!beforeCitations.count(id) || !afterCitations.count(id)) {
            continue;
        }
        appendAll(
            provenance,
            scalarChanges(id, beforeCitations.at(id), afterCitations.at(id), {"layer", "citation", "short", "year", "url"}));
    }
    for (const auto& region : regionsOf(after)) {
        const std::string id = asString(region.value("id", json()));
        if (!beforeRegions.count(id) || !afterRegions.count(id)) {
            continue;
        }
        appendAll(content, scalarChanges(id, beforeRegions.at(id), afterRegions.at(id), {"label"}));
        appendAll(authoredGeometry, scalarChanges(id, beforeRegions.at(id), afterRegions.at(id), {"geometry"}));
    }

    json projectionConsequences = json::object();
    const ProjectionView views[] = {
        ProjectionView::Argument,
        ProjectionView::Timeline,
        ProjectionView::Evidence,
        ProjectionView::Frontier,
    };
    for (auto view : views) {
        json left = projectAnalyticalViewJson(before, view);
        json right = projectAnalyticalViewJson(after, view);
        projectionConsequences[std::string{projectionViewName(view)}] = {
            {"nodes", addedRemoved(idList(arrayOrEmpty(left, "nodes")), idList(arrayOrEmpty(right, "nodes")))},
            {"relations",
             addedRemoved(idList(arrayOrEmpty(left, "relations")), idList(arrayOrEmpty(right, "relations")))},
        };
    }

    json identities = json::object();
    identities["citations"] = addedRemoved(idList(citationsOf(before)), idList(citationsOf(after)));
    identities["nodes"] = addedRemoved(idList(nodesOf(before)), idList(nodesOf(after)));
    identities["regions"] = addedRemoved(idList(regionsOf(before)), idList(regionsOf(after)));
    identities["relations"] = addedRemoved(idList(relationsOf(before)), idList(relationsOf(after)));

    json topology = json::object();
    topology["addedRelations"] = identities.at("relations").at("added");
    topology["removedRelations"] = identities.at("relations").at("removed");
    topology["changes"] = topologyChanges;

    json diff = json::object();
    diff["after"] = {
        {"documentId", asString(after.value("id", json()))},
        {"documentVersion", std::string{DOCUMENT_CONTRACT}},
    };
    diff["authoredGeometry"] = authoredGeometry;
    diff["before"] = {
        {"documentId", asString(before.value("id", json()))},
        {"documentVersion", std::string{DOCUMENT_CONTRACT}},
    };
    diff["content"] = content;
    diff["evidenceBindings"] = evidenceBindings;
    diff["identities"] = identities;
    diff["projectionConsequences"] = projectionConsequences;
    diff["provenance"] = provenance;
    diff["runtime"] = std::string{RUNTIME_API_VERSION};
    diff["topology"] = topology;
    diff["version"] = std::string{DIFF_CONTRACT};
    return diff;
}

json explainIdentityJson(
    const json& document,
    const std::string& identity,
    const json& support) {
    auto nodes = indexById(nodesOf(document));
    auto relations = indexById(relationsOf(document));
    auto citations = indexById(citationsOf(document));
    json base = json::object();
    base["documentId"] = asString(document.value("id", json()));
    base["documentVersion"] = std::string{DOCUMENT_CONTRACT};
    base["identity"] = identity;
    base["runtime"] = std::string{RUNTIME_API_VERSION};
    base["version"] = std::string{EXPLANATION_CONTRACT};
    if (nodes.count(identity)) {
        return explainNode(document, identity, support);
    }
    if (relations.count(identity)) {
        const json& relation = relations.at(identity);
        json semantic = json();
        json warrant = json();
        if (support.contains("argument") && support.at("argument").is_object()) {
            for (const auto& item : arrayOrEmpty(support.at("argument"), "relations")) {
                if (asString(item.value("id", json())) == identity) {
                    semantic = json::object();
                    semantic["from"] = asString(item.value("from", json()));
                    semantic["kind"] = asString(item.value("kind", json()));
                    semantic["to"] = asString(item.value("to", json()));
                    semantic["warrantClaimId"] = item.contains("warrantClaimId")
                                                    ? item.value("warrantClaimId", json())
                                                    : json();
                    const std::string warrantId = asString(item.value("warrantClaimId", json()));
                    if (!warrantId.empty()) {
                        for (const auto& claim : arrayOrEmpty(support.at("argument"), "claims")) {
                            if (asString(claim.value("id", json())) == warrantId) {
                                warrant = {
                                    {"id", warrantId},
                                    {"role", asString(claim.value("role", json()))},
                                    {"statement", asString(claim.value("statement", json()))},
                                };
                                break;
                            }
                        }
                    }
                    break;
                }
            }
        }
        json result = base;
        result["kind"] = "relation";
        result["object"] = quotedRelation(relation);
        result["ok"] = true;
        result["semantic"] = semantic;
        result["stale"] = staleForNodes(
            support,
            {asString(relation.value("from", json())), asString(relation.value("to", json()))});
        result["warrant"] = warrant;
        return result;
    }
    if (citations.count(identity)) {
        json bound = json::array();
        std::vector<std::string> boundIds;
        for (const auto& node : nodesOf(document)) {
            for (const auto& citationIdValue : arrayOrEmpty(node, "citationIds")) {
                if (asString(citationIdValue) == identity) {
                    bound.push_back(asString(node.value("id", json())));
                    boundIds.push_back(asString(node.value("id", json())));
                    break;
                }
            }
        }
        json result = base;
        result["boundNodeIds"] = bound;
        result["kind"] = "citation";
        result["object"] = quotedCitation(citations.at(identity));
        result["ok"] = true;
        result["stale"] = staleForNodes(support, boundIds);
        return result;
    }
    for (const auto& region : regionsOf(document)) {
        if (asString(region.value("id", json())) == identity) {
            json result = base;
            result["kind"] = "region";
            result["object"] = {
                {"id", identity},
                {"label", asString(region.value("label", json()))},
            };
            result["ok"] = true;
            return result;
        }
    }
    json result = base;
    result["error"] = {
        {"code", "E_IDENTITY_NOT_FOUND"},
        {"message", "unknown identity " + identity},
    };
    result["kind"] = "unknown";
    result["ok"] = false;
    return result;
}

json inspectJson(const json& document, std::string_view sourceText, const json& request) {
    auto issues = validateHornDocumentJson(document);
    json validation = json::parse(
        toValidationReportJson(asString(document.value("id", json())), std::move(issues)));
    json projections = json::object();
    for (const auto& viewValue : arrayOrEmpty(request, "projections")) {
        const ProjectionView view = parseProjectionView(asString(viewValue));
        projections[std::string{projectionViewName(view)}] =
            projectAnalyticalViewJson(document, view);
    }
    json explanations = json::array();
    if (asBool(request.value("explainAll", json()), false)) {
        auto pushIds = [&](const json& items) {
            for (const auto& item : items) {
                explanations.push_back(
                    explainIdentityJson(document, asString(item.value("id", json())), request));
            }
        };
        pushIds(nodesOf(document));
        pushIds(relationsOf(document));
        pushIds(citationsOf(document));
        pushIds(regionsOf(document));
    }
    json queries = json::array();
    for (const auto& query : arrayOrEmpty(request, "queries")) {
        queries.push_back(runQueryJson(document, query));
    }
    json impact = json();
    if (request.contains("evidence") && !request.at("evidence").is_null() &&
        request.contains("bindings") && !request.at("bindings").is_null()) {
        impact = assessImpactJson(document, request.at("evidence"), request.at("bindings"));
    }
    json packet = json::object();
    packet["explanations"] = explanations;
    packet["impact"] = impact;
    packet["projections"] = projections;
    packet["queries"] = queries;
    packet["runtime"] = std::string{RUNTIME_API_VERSION};
    packet["source"] = {
        {"digest", sha256Prefixed(sourceText)},
        {"documentId", asString(document.value("id", json()))},
        {"documentVersion", asString(document.value("version", json()))},
    };
    packet["validation"] = validation;
    packet["version"] = std::string{INSPECT_CONTRACT};
    return packet;
}

} // namespace

ProjectionView parseProjectionView(std::string_view name) {
    if (name == "argument") {
        return ProjectionView::Argument;
    }
    if (name == "timeline") {
        return ProjectionView::Timeline;
    }
    if (name == "evidence") {
        return ProjectionView::Evidence;
    }
    if (name == "frontier") {
        return ProjectionView::Frontier;
    }
    throw std::runtime_error(
        "Unknown projection view " + std::string{name} +
        ". Expected argument|timeline|evidence|frontier.");
}

nlohmann::json projectAnalyticalViewJson(const nlohmann::json& document, ProjectionView view) {
    switch (view) {
        case ProjectionView::Argument:
            return projectArgumentView(document);
        case ProjectionView::Timeline:
            return projectTimelineView(document);
        case ProjectionView::Evidence:
            return projectEvidenceView(document);
        case ProjectionView::Frontier:
            return projectFrontierView(document);
    }
    throw std::runtime_error("unknown projection view");
}

std::string projectAnalyticalViewText(
    std::string_view canonicalHornDocumentJson,
    ProjectionView view) {
    const json document = json::parse(canonicalHornDocumentJson);
    return dumpNormalized(projectAnalyticalViewJson(document, view));
}

std::string queryDocumentText(
    std::string_view canonicalHornDocumentJson,
    std::string_view queryRequestJson) {
    const json document = json::parse(canonicalHornDocumentJson);
    const json request = json::parse(queryRequestJson);
    return dumpNormalized(runQueryJson(document, request));
}

std::string explainIdentityText(
    std::string_view canonicalHornDocumentJson,
    std::string_view identity,
    std::string_view supportingArtifactsJson) {
    const json document = json::parse(canonicalHornDocumentJson);
    const json support = supportingArtifactsJson.empty()
                             ? json::object()
                             : json::parse(supportingArtifactsJson);
    return dumpNormalized(explainIdentityJson(document, std::string{identity}, support));
}

std::string assessImpactText(
    std::string_view canonicalHornDocumentJson,
    std::string_view evidenceSnapshotJson,
    std::string_view bindingsJson) {
    const json document = json::parse(canonicalHornDocumentJson);
    const json evidence = json::parse(evidenceSnapshotJson);
    const json bindings = json::parse(bindingsJson);
    return dumpNormalized(assessImpactJson(document, evidence, bindings));
}

std::string diffDocumentsText(
    std::string_view beforeHornDocumentJson,
    std::string_view afterHornDocumentJson) {
    const json before = json::parse(beforeHornDocumentJson);
    const json after = json::parse(afterHornDocumentJson);
    return dumpNormalized(diffDocumentsJson(before, after));
}

std::string inspectDocumentText(
    std::string_view canonicalHornDocumentJson,
    std::string_view requestJson) {
    const json document = json::parse(canonicalHornDocumentJson);
    const json request = requestJson.empty() ? json::object() : json::parse(requestJson);
    return dumpNormalized(inspectJson(document, canonicalHornDocumentJson, request));
}

std::string ProjectionService::projectDocument(
    std::string_view canonicalHornDocumentJson,
    ProjectionView view) const {
    return projectAnalyticalViewText(canonicalHornDocumentJson, view);
}

std::string QueryService::query(
    std::string_view canonicalHornDocumentJson,
    std::string_view queryRequestJson) const {
    return queryDocumentText(canonicalHornDocumentJson, queryRequestJson);
}

std::string ExplanationService::explain(
    std::string_view canonicalHornDocumentJson,
    std::string_view identity,
    std::string_view supportingArtifactsJson) const {
    return explainIdentityText(canonicalHornDocumentJson, identity, supportingArtifactsJson);
}

std::string ImpactService::assessImpact(
    std::string_view canonicalHornDocumentJson,
    std::string_view evidenceSnapshotJson,
    std::string_view bindingsJson) const {
    return assessImpactText(
        canonicalHornDocumentJson, evidenceSnapshotJson, bindingsJson);
}

std::string DiffService::diff(
    std::string_view beforeHornDocumentJson,
    std::string_view afterHornDocumentJson) const {
    return diffDocumentsText(beforeHornDocumentJson, afterHornDocumentJson);
}

} // namespace horn
