#include "QueryService.h"

#include <algorithm>
#include <cstddef>
#include <deque>
#include <iterator>
#include <limits>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

namespace horn {
namespace {
using json = nlohmann::json;

struct NodeOrder {
    std::map<std::string, std::size_t> rank;

    [[nodiscard]] std::size_t get(const std::string& id) const {
        const auto it = rank.find(id);
        return it == rank.end() ? std::numeric_limits<std::size_t>::max() : it->second;
    }
};

struct DialogueEdge {
    std::string relationId;
    std::string kind;
    std::string earlierNodeId;
    std::string responseNodeId;
};

struct DialogueGraph {
    std::string focusNodeId;
    std::vector<std::string> nodeIds;
    std::vector<DialogueEdge> edges;
};

struct GraphOptions {
    std::set<std::string> relationKinds;
    std::set<std::string> suppressedNodeIds;
    std::set<std::string> suppressedRelationIds;
};

[[nodiscard]] std::string requiredString(const json& object, std::string_view key, std::string_view subject) {
    const auto it = object.find(std::string{key});
    if (it == object.end() || !it->is_string() || it->get_ref<const std::string&>().empty()) {
        throw std::invalid_argument(std::string{subject} + " needs " + std::string{key});
    }
    return it->get<std::string>();
}

[[nodiscard]] NodeOrder stableNodeOrder(const json& document) {
    if (!document.contains("nodes") || !document.at("nodes").is_array()) {
        throw std::invalid_argument("Horn document needs nodes");
    }

    struct NumberedNode {
        std::string id;
        long long number;
    };
    std::vector<NumberedNode> nodes;
    for (const auto& node : document.at("nodes")) {
        if (!node.is_object()) throw std::invalid_argument("Horn node must be an object");
        const auto id = requiredString(node, "id", "Horn node");
        if (!node.contains("number") || !node.at("number").is_number_integer()) {
            throw std::invalid_argument("Horn node needs integer number");
        }
        nodes.push_back({id, node.at("number").get<long long>()});
    }
    std::sort(nodes.begin(), nodes.end(), [](const auto& left, const auto& right) {
        return left.number == right.number ? left.id < right.id : left.number < right.number;
    });

    NodeOrder order;
    for (std::size_t index = 0; index < nodes.size(); ++index) {
        order.rank.emplace(nodes[index].id, index);
    }
    return order;
}

[[nodiscard]] bool hasNode(const json& document, const std::string& id) {
    return std::any_of(document.at("nodes").begin(), document.at("nodes").end(), [&](const auto& node) {
        return node.is_object() && node.value("id", std::string{}) == id;
    });
}

void requireKnownNode(const json& document, const std::string& id, std::string_view subject) {
    if (!hasNode(document, id)) {
        throw std::invalid_argument("unknown Horn " + std::string{subject} + " node: " + id);
    }
}

[[nodiscard]] std::set<std::string> defaultRelationKinds() {
    return {"supports", "disputes", "interprets-as"};
}

[[nodiscard]] std::set<std::string> stringSet(const json& value, std::string_view subject) {
    if (!value.is_array()) throw std::invalid_argument(std::string{subject} + " must be an array");
    std::set<std::string> result;
    for (const auto& entry : value) {
        if (!entry.is_string() || entry.get_ref<const std::string&>().empty()) {
            throw std::invalid_argument(std::string{subject} + " entries must be non-empty strings");
        }
        const auto item = entry.get<std::string>();
        if (!result.insert(item).second) {
            throw std::invalid_argument(std::string{subject} + " contains duplicate " + item);
        }
    }
    return result;
}

[[nodiscard]] GraphOptions graphOptionsFromRequest(const json& request, bool includeSuppression) {
    GraphOptions options;
    options.relationKinds = request.contains("relationKinds")
        ? stringSet(request.at("relationKinds"), "relationKinds")
        : defaultRelationKinds();

    if (includeSuppression && request.contains("suppress")) {
        const auto& suppress = request.at("suppress");
        if (!suppress.is_object()) throw std::invalid_argument("suppress must be an object");
        if (suppress.contains("nodeIds")) {
            options.suppressedNodeIds = stringSet(suppress.at("nodeIds"), "suppress.nodeIds");
        }
        if (suppress.contains("relationIds")) {
            options.suppressedRelationIds = stringSet(suppress.at("relationIds"), "suppress.relationIds");
        }
    }
    return options;
}

[[nodiscard]] std::vector<std::string> sortNodeIds(const std::set<std::string>& ids, const NodeOrder& order) {
    std::vector<std::string> result{ids.begin(), ids.end()};
    std::sort(result.begin(), result.end(), [&](const auto& left, const auto& right) {
        const auto leftRank = order.get(left);
        const auto rightRank = order.get(right);
        return leftRank == rightRank ? left < right : leftRank < rightRank;
    });
    return result;
}

[[nodiscard]] DialogueGraph deriveDialogueGraph(
    const json& document,
    const std::string& focusNodeId,
    const GraphOptions& options) {
    requireKnownNode(document, focusNodeId, "focus");
    const auto order = stableNodeOrder(document);

    if (options.suppressedNodeIds.count(focusNodeId) != 0U) {
        return {focusNodeId, {}, {}};
    }

    std::vector<DialogueEdge> edges;
    if (!document.contains("relations") || !document.at("relations").is_array()) {
        throw std::invalid_argument("Horn document needs relations");
    }
    for (const auto& relation : document.at("relations")) {
        if (!relation.is_object()) throw std::invalid_argument("Horn relation must be an object");
        const auto id = requiredString(relation, "id", "Horn relation");
        const auto kind = requiredString(relation, "kind", "Horn relation");
        const auto from = requiredString(relation, "from", "Horn relation");
        const auto to = requiredString(relation, "to", "Horn relation");
        if (options.relationKinds.count(kind) == 0U) continue;
        if (options.suppressedRelationIds.count(id) != 0U) continue;
        if (options.suppressedNodeIds.count(from) != 0U || options.suppressedNodeIds.count(to) != 0U) continue;
        edges.push_back({id, kind, to, from});
    }

    std::sort(edges.begin(), edges.end(), [&](const auto& left, const auto& right) {
        const auto earlierLeft = order.get(left.earlierNodeId);
        const auto earlierRight = order.get(right.earlierNodeId);
        if (earlierLeft != earlierRight) return earlierLeft < earlierRight;
        const auto responseLeft = order.get(left.responseNodeId);
        const auto responseRight = order.get(right.responseNodeId);
        if (responseLeft != responseRight) return responseLeft < responseRight;
        return left.relationId < right.relationId;
    });

    std::map<std::string, std::vector<const DialogueEdge*>> responses;
    for (const auto& edge : edges) responses[edge.earlierNodeId].push_back(&edge);

    std::set<std::string> reachable{focusNodeId};
    std::deque<std::string> queue{focusNodeId};
    while (!queue.empty()) {
        const auto current = queue.front();
        queue.pop_front();
        const auto it = responses.find(current);
        if (it == responses.end()) continue;
        for (const auto* edge : it->second) {
            if (reachable.insert(edge->responseNodeId).second) queue.push_back(edge->responseNodeId);
        }
    }

    std::vector<DialogueEdge> reachableEdges;
    for (const auto& edge : edges) {
        if (reachable.count(edge.earlierNodeId) != 0U && reachable.count(edge.responseNodeId) != 0U) {
            reachableEdges.push_back(edge);
        }
    }
    return {focusNodeId, sortNodeIds(reachable, order), std::move(reachableEdges)};
}

[[nodiscard]] std::vector<std::string> frontier(const DialogueGraph& graph) {
    std::set<std::string> outgoing;
    for (const auto& edge : graph.edges) outgoing.insert(edge.earlierNodeId);
    std::vector<std::string> result;
    for (const auto& node : graph.nodeIds) if (outgoing.count(node) == 0U) result.push_back(node);
    return result;
}

[[nodiscard]] json graphResult(const DialogueGraph& graph) {
    json edges = json::array();
    for (const auto& edge : graph.edges) {
        edges.push_back({
            {"relationId", edge.relationId},
            {"kind", edge.kind},
            {"earlierNodeId", edge.earlierNodeId},
            {"responseNodeId", edge.responseNodeId},
        });
    }
    return {
        {"focusNodeId", graph.focusNodeId},
        {"nodeIds", graph.nodeIds},
        {"edges", std::move(edges)},
        {"frontierNodeIds", frontier(graph)},
    };
}

[[nodiscard]] std::vector<std::string> setDifferenceStable(
    const std::vector<std::string>& left,
    const std::vector<std::string>& right,
    const NodeOrder& order) {
    const std::set<std::string> rightSet{right.begin(), right.end()};
    std::set<std::string> diff;
    for (const auto& item : left) if (rightSet.count(item) == 0U) diff.insert(item);
    return sortNodeIds(diff, order);
}

[[nodiscard]] json counterfactualResult(const json& document, const json& request) {
    const auto focus = requiredString(request, "focusNodeId", "query request");
    const auto order = stableNodeOrder(document);
    const auto baseline = deriveDialogueGraph(document, focus, graphOptionsFromRequest(request, false));
    const auto result = deriveDialogueGraph(document, focus, graphOptionsFromRequest(request, true));
    const auto baselineFrontier = frontier(baseline);
    const auto resultFrontier = frontier(result);

    std::vector<std::string> suppressedNodes;
    std::vector<std::string> suppressedRelations;
    if (request.contains("suppress")) {
        const auto& suppress = request.at("suppress");
        if (suppress.contains("nodeIds")) {
            suppressedNodes = sortNodeIds(stringSet(suppress.at("nodeIds"), "suppress.nodeIds"), order);
        }
        if (suppress.contains("relationIds")) {
            const auto set = stringSet(suppress.at("relationIds"), "suppress.relationIds");
            suppressedRelations.assign(set.begin(), set.end());
        }
    }

    return {
        {"focusNodeId", focus},
        {"suppressedNodeIds", suppressedNodes},
        {"suppressedRelationIds", suppressedRelations},
        {"baseline", {{"reachableNodeIds", baseline.nodeIds}, {"frontierNodeIds", baselineFrontier}}},
        {"result", {{"reachableNodeIds", result.nodeIds}, {"frontierNodeIds", resultFrontier}}},
        {"disconnectedNodeIds", setDifferenceStable(baseline.nodeIds, result.nodeIds, order)},
        {"frontierDelta", {
            {"addedNodeIds", setDifferenceStable(resultFrontier, baselineFrontier, order)},
            {"removedNodeIds", setDifferenceStable(baselineFrontier, resultFrontier, order)},
        }},
    };
}

[[nodiscard]] std::set<std::string> intersectSets(const std::set<std::string>& left, const std::set<std::string>& right) {
    std::set<std::string> result;
    std::set_intersection(left.begin(), left.end(), right.begin(), right.end(), std::inserter(result, result.begin()));
    return result;
}

[[nodiscard]] json dominatorResult(const json& document, const json& request) {
    const auto focus = requiredString(request, "focusNodeId", "query request");
    const auto target = requiredString(request, "targetNodeId", "dominators query");
    requireKnownNode(document, target, "target");
    const auto graph = deriveDialogueGraph(document, focus, graphOptionsFromRequest(request, false));
    if (std::find(graph.nodeIds.begin(), graph.nodeIds.end(), target) == graph.nodeIds.end()) {
        throw std::invalid_argument("Horn target node is not reachable from focus: " + target);
    }

    const auto order = stableNodeOrder(document);
    const std::set<std::string> all{graph.nodeIds.begin(), graph.nodeIds.end()};
    std::map<std::string, std::vector<std::string>> predecessors;
    for (const auto& edge : graph.edges) predecessors[edge.responseNodeId].push_back(edge.earlierNodeId);

    std::map<std::string, std::set<std::string>> dominators;
    for (const auto& node : graph.nodeIds) dominators[node] = node == focus ? std::set<std::string>{focus} : all;

    bool changed = true;
    while (changed) {
        changed = false;
        for (const auto& node : graph.nodeIds) {
            if (node == focus) continue;
            const auto predIt = predecessors.find(node);
            if (predIt == predecessors.end() || predIt->second.empty()) continue;
            auto next = dominators.at(predIt->second.front());
            for (std::size_t index = 1; index < predIt->second.size(); ++index) {
                next = intersectSets(next, dominators.at(predIt->second[index]));
            }
            next.insert(node);
            if (next != dominators.at(node)) {
                dominators[node] = std::move(next);
                changed = true;
            }
        }
    }

    const auto doms = sortNodeIds(dominators.at(target), order);
    std::vector<std::string> strict;
    for (const auto& id : doms) if (id != focus && id != target) strict.push_back(id);
    return {
        {"focusNodeId", focus},
        {"targetNodeId", target},
        {"dominatorNodeIds", doms},
        {"strictDominatorNodeIds", strict},
    };
}

struct ResidualEdge {
    std::string to;
    std::size_t reverseIndex;
    int capacity;
};
using ResidualGraph = std::map<std::string, std::vector<ResidualEdge>>;

void addResidualEdge(ResidualGraph& graph, const std::string& from, const std::string& to, int capacity) {
    auto& forward = graph[from];
    auto& reverse = graph[to];
    const auto forwardIndex = forward.size();
    const auto reverseIndex = reverse.size();
    forward.push_back({to, reverseIndex, capacity});
    reverse.push_back({from, forwardIndex, 0});
}

struct ParentStep {
    std::string from;
    std::size_t edgeIndex;
};

[[nodiscard]] bool augmentingPath(
    const ResidualGraph& graph,
    const std::string& source,
    const std::string& sink,
    std::map<std::string, ParentStep>& parent) {
    parent.clear();
    std::set<std::string> visited{source};
    std::deque<std::string> queue{source};
    while (!queue.empty()) {
        const auto current = queue.front();
        queue.pop_front();
        const auto found = graph.find(current);
        if (found == graph.end()) continue;
        for (std::size_t edgeIndex = 0; edgeIndex < found->second.size(); ++edgeIndex) {
            const auto& edge = found->second[edgeIndex];
            if (edge.capacity <= 0 || visited.count(edge.to) != 0U) continue;
            visited.insert(edge.to);
            parent[edge.to] = {current, edgeIndex};
            if (edge.to == sink) return true;
            queue.push_back(edge.to);
        }
    }
    return false;
}

[[nodiscard]] std::set<std::string> residualReachable(const ResidualGraph& graph, const std::string& source) {
    std::set<std::string> reachable{source};
    std::deque<std::string> queue{source};
    while (!queue.empty()) {
        const auto current = queue.front();
        queue.pop_front();
        const auto found = graph.find(current);
        if (found == graph.end()) continue;
        for (const auto& edge : found->second) {
            if (edge.capacity <= 0 || reachable.count(edge.to) != 0U) continue;
            reachable.insert(edge.to);
            queue.push_back(edge.to);
        }
    }
    return reachable;
}

[[nodiscard]] json minimumCutResult(const json& document, const json& request) {
    const auto focus = requiredString(request, "focusNodeId", "query request");
    const auto target = requiredString(request, "targetNodeId", "min-cut query");
    requireKnownNode(document, target, "target");
    const auto graph = deriveDialogueGraph(document, focus, graphOptionsFromRequest(request, false));
    if (std::find(graph.nodeIds.begin(), graph.nodeIds.end(), target) == graph.nodeIds.end()) {
        throw std::invalid_argument("Horn target node is not reachable from focus: " + target);
    }
    if (focus == target) {
        return {{"focusNodeId", focus}, {"targetNodeId", target}, {"finite", true}, {"cardinality", 0}, {"cutNodeIds", json::array()}};
    }

    const int infinity = static_cast<int>(graph.nodeIds.size()) + 1;
    const auto nodeIn = [](const std::string& id) { return "in:" + id; };
    const auto nodeOut = [](const std::string& id) { return "out:" + id; };
    ResidualGraph network;
    for (const auto& node : graph.nodeIds) {
        addResidualEdge(network, nodeIn(node), nodeOut(node), node == focus || node == target ? infinity : 1);
    }
    for (const auto& edge : graph.edges) {
        addResidualEdge(network, nodeOut(edge.earlierNodeId), nodeIn(edge.responseNodeId), infinity);
    }

    const auto source = nodeOut(focus);
    const auto sink = nodeIn(target);
    int flow = 0;
    std::map<std::string, ParentStep> parent;
    while (flow < infinity && augmentingPath(network, source, sink, parent)) {
        int bottleneck = infinity;
        auto cursor = sink;
        while (cursor != source) {
            const auto step = parent.at(cursor);
            bottleneck = std::min(bottleneck, network.at(step.from).at(step.edgeIndex).capacity);
            cursor = step.from;
        }
        cursor = sink;
        while (cursor != source) {
            const auto step = parent.at(cursor);
            auto& edge = network.at(step.from).at(step.edgeIndex);
            const auto to = edge.to;
            const auto reverseIndex = edge.reverseIndex;
            edge.capacity -= bottleneck;
            network.at(to).at(reverseIndex).capacity += bottleneck;
            cursor = step.from;
        }
        flow += bottleneck;
    }

    if (flow >= infinity) {
        return {{"focusNodeId", focus}, {"targetNodeId", target}, {"finite", false}, {"cardinality", nullptr}, {"cutNodeIds", json::array()}};
    }

    const auto reachable = residualReachable(network, source);
    std::vector<std::string> cut;
    for (const auto& node : graph.nodeIds) {
        if (node == focus || node == target) continue;
        if (reachable.count(nodeIn(node)) != 0U && reachable.count(nodeOut(node)) == 0U) cut.push_back(node);
    }
    return {{"focusNodeId", focus}, {"targetNodeId", target}, {"finite", true}, {"cardinality", flow}, {"cutNodeIds", cut}};
}

void validateRequestShape(const json& request) {
    if (!request.is_object()) throw std::invalid_argument("query request must be an object");
    if (request.value("version", std::string{}) != "horn-query-request/0.1") {
        throw std::invalid_argument("unsupported query request version");
    }
    const auto operation = requiredString(request, "operation", "query request");
    static const std::set<std::string> supported{"graph", "counterfactual", "dominators", "min-cut"};
    if (supported.count(operation) == 0U) throw std::invalid_argument("unsupported query operation " + operation);
    (void)requiredString(request, "focusNodeId", "query request");
    if ((operation == "dominators" || operation == "min-cut") && !request.contains("targetNodeId")) {
        throw std::invalid_argument(operation + " query needs targetNodeId");
    }
    if (operation != "counterfactual" && request.contains("suppress")) {
        throw std::invalid_argument("suppress is only valid for counterfactual queries");
    }
}

[[nodiscard]] json executeQuery(const json& document, const json& request) {
    if (!document.is_object() || document.value("version", std::string{}) != "horn-document/0.1") {
        throw std::invalid_argument("query source must be horn-document/0.1");
    }
    validateRequestShape(request);
    const auto documentId = requiredString(document, "id", "Horn document");
    const auto operation = request.at("operation").get<std::string>();
    const auto focus = request.at("focusNodeId").get<std::string>();
    requireKnownNode(document, focus, "focus");

    json result;
    if (operation == "graph") {
        result = graphResult(deriveDialogueGraph(document, focus, graphOptionsFromRequest(request, false)));
    } else if (operation == "counterfactual") {
        result = counterfactualResult(document, request);
    } else if (operation == "dominators") {
        result = dominatorResult(document, request);
    } else {
        result = minimumCutResult(document, request);
    }

    return {
        {"version", "horn-query-result/0.1"},
        {"requestVersion", "horn-query-request/0.1"},
        {"operation", operation},
        {"source", {{"documentId", documentId}, {"documentVersion", "horn-document/0.1"}}},
        {"result", std::move(result)},
    };
}
} // namespace

std::string QueryService::queryDocument(
    std::string_view canonicalHornDocumentJson,
    std::string_view hornQueryRequestJson) const {
    try {
        const auto document = json::parse(canonicalHornDocumentJson.begin(), canonicalHornDocumentJson.end());
        const auto request = json::parse(hornQueryRequestJson.begin(), hornQueryRequestJson.end());
        return executeQuery(document, request).dump();
    } catch (const json::exception& error) {
        throw std::invalid_argument(std::string{"invalid Horn query JSON: "} + error.what());
    }
}

} // namespace horn
