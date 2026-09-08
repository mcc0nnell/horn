import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeHornCounterfactual,
  analyzeHornDominators,
  deriveHornDialogueFrontier,
  deriveHornDialogueGraph,
} from "./analysis";
import type { HornDocument, HornNode } from "./types";

function node(id: string, number: number): HornNode {
  return {
    id,
    number,
    kind: id === "focus" ? "focus-claim" : "claim",
    origin: "authored",
    ...(id === "focus" ? { focus: true } : {}),
    label: id,
    text: id,
    geometry: { x: number * 100, y: 100, w: 80, h: 50 },
    citationIds: ["cartographic"],
  };
}

const document: HornDocument = {
  id: "horn:test:reactor-diamond",
  version: "horn-document/0.1",
  vocabulary: ["argumentation"],
  unitSize: "concept-diagram",
  authority: "authored",
  after: {
    name: "Robert E. Horn",
    works: ["Mapping Great Debates: Can Computers Think? (1998)"],
  },
  title: "Reactor diamond",
  subtitle: "Deterministic structural analysis fixture",
  issueQuestion: "What survives a structural counterfactual?",
  canvas: { width: 1000, height: 500, unit: "test", origin: "top-left" },
  regions: [],
  nodes: [
    node("focus", 1),
    node("a", 2),
    node("b", 3),
    node("join", 4),
    node("tail", 5),
    node("unrelated", 6),
  ],
  relations: [
    { id: "a-focus", kind: "supports", from: "a", to: "focus", label: "supports" },
    { id: "b-focus", kind: "disputes", from: "b", to: "focus", label: "disputes" },
    { id: "join-a", kind: "supports", from: "join", to: "a", label: "supports" },
    { id: "join-b", kind: "disputes", from: "join", to: "b", label: "disputes" },
    { id: "tail-join", kind: "supports", from: "tail", to: "join", label: "supports" },
    { id: "unrelated-focus", kind: "addresses", from: "unrelated", to: "focus", label: "addresses" },
  ],
  citations: [
    {
      id: "cartographic",
      layer: "cartographic",
      citation: "test",
      short: "test",
      year: 2026,
    },
  ],
  readingPath: ["focus", "a", "b", "join", "tail"],
  rights: "test fixture",
};

test("dialogue graph is derived in reader direction and ignores non-dialectical relations", () => {
  const graph = deriveHornDialogueGraph(document, "focus");

  assert.deepEqual(graph.nodeIds, ["focus", "a", "b", "join", "tail"]);
  assert.deepEqual(deriveHornDialogueFrontier(graph), ["tail"]);
  assert.equal(graph.edges.some((edge) => edge.responseNodeId === "unrelated"), false);
  assert.ok(
    graph.edges.some(
      (edge) => edge.relationId === "a-focus" && edge.earlierNodeId === "focus" && edge.responseNodeId === "a",
    ),
  );
});

test("counterfactual suppression reports the exact disconnected cone without mutating the document", () => {
  const before = JSON.stringify(document);
  const result = analyzeHornCounterfactual(document, "focus", {
    suppressedNodeIds: ["join"],
  });

  assert.deepEqual(result.baseline.reachableNodeIds, ["focus", "a", "b", "join", "tail"]);
  assert.deepEqual(result.result.reachableNodeIds, ["focus", "a", "b"]);
  assert.deepEqual(result.disconnectedNodeIds, ["join", "tail"]);
  assert.deepEqual(result.baseline.frontierNodeIds, ["tail"]);
  assert.deepEqual(result.result.frontierNodeIds, ["a", "b"]);
  assert.deepEqual(result.frontierDelta, {
    addedNodeIds: ["a", "b"],
    removedNodeIds: ["tail"],
  });
  assert.equal(JSON.stringify(document), before);
});

test("diamond keeps downstream structure alive when only one branch is suppressed", () => {
  const result = analyzeHornCounterfactual(document, "focus", {
    suppressedNodeIds: ["a"],
  });

  assert.deepEqual(result.disconnectedNodeIds, ["a"]);
  assert.deepEqual(result.result.frontierNodeIds, ["tail"]);
});

test("dominators identify only nodes present on every path to the target", () => {
  const result = analyzeHornDominators(document, "focus", "tail");

  assert.deepEqual(result.dominatorNodeIds, ["focus", "join", "tail"]);
  assert.deepEqual(result.strictDominatorNodeIds, ["join"]);
});

test("analysis can explicitly narrow the dialogue vocabulary", () => {
  const supportsOnly = deriveHornDialogueGraph(document, "focus", {
    relationKinds: ["supports"],
  });

  assert.deepEqual(supportsOnly.nodeIds, ["focus", "a", "join", "tail"]);
});
