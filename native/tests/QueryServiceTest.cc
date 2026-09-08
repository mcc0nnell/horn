#include "QueryService.h"

#include <cassert>
#include <iostream>

#include <nlohmann/json.hpp>

namespace {
using json = nlohmann::json;

const char* fixture = R"JSON({
  "id":"horn:test:native-query",
  "version":"horn-document/0.1",
  "nodes":[
    {"id":"focus","number":1},
    {"id":"a","number":2},
    {"id":"b","number":3},
    {"id":"join","number":4},
    {"id":"target","number":5},
    {"id":"unrelated","number":6}
  ],
  "relations":[
    {"id":"a-focus","kind":"supports","from":"a","to":"focus"},
    {"id":"b-focus","kind":"disputes","from":"b","to":"focus"},
    {"id":"join-a","kind":"supports","from":"join","to":"a"},
    {"id":"join-b","kind":"disputes","from":"join","to":"b"},
    {"id":"target-join","kind":"supports","from":"target","to":"join"},
    {"id":"unrelated-focus","kind":"addresses","from":"unrelated","to":"focus"}
  ]
})JSON";

json run(const json& request) {
    horn::QueryService service;
    return json::parse(service.queryDocument(fixture, request.dump()));
}
} // namespace

int main() {
    auto graph = run({{"version","horn-query-request/0.1"},{"operation","graph"},{"focusNodeId","focus"}});
    assert(graph.at("result").at("nodeIds") == json::array({"focus","a","b","join","target"}));
    assert(graph.at("result").at("frontierNodeIds") == json::array({"target"}));
    assert(graph.at("result").at("edges").size() == 5);

    auto counterfactual = run({
        {"version","horn-query-request/0.1"},
        {"operation","counterfactual"},
        {"focusNodeId","focus"},
        {"suppress",{{"nodeIds",json::array({"join"})}}},
    });
    assert(counterfactual.at("result").at("disconnectedNodeIds") == json::array({"join","target"}));
    assert(counterfactual.at("result").at("result").at("frontierNodeIds") == json::array({"a","b"}));

    auto dominators = run({
        {"version","horn-query-request/0.1"},
        {"operation","dominators"},
        {"focusNodeId","focus"},
        {"targetNodeId","target"},
    });
    assert(dominators.at("result").at("dominatorNodeIds") == json::array({"focus","join","target"}));
    assert(dominators.at("result").at("strictDominatorNodeIds") == json::array({"join"}));

    auto cut = run({
        {"version","horn-query-request/0.1"},
        {"operation","min-cut"},
        {"focusNodeId","focus"},
        {"targetNodeId","target"},
    });
    assert(cut.at("result").at("finite") == true);
    assert(cut.at("result").at("cardinality") == 1);
    assert(cut.at("result").at("cutNodeIds") == json::array({"join"}));

    std::cout << "horn native query tests passed\n";
    return 0;
}
