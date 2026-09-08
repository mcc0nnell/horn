import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHornMinimumCut } from "./cut";
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
    geometry: { x: number * 90, y: 40, w: 70, h: 40 },
    citationIds: ["cartographic"],
  };
}

function fixture(direct = false): HornDocument {
  return {
    id: direct ? "horn:test:cut-direct" : "horn:test:cut-diamond",
    version: "horn-document/0.1",
    vocabulary: ["argumentation"],
    unitSize: "concept-diagram",
    authority: "authored",
    after: { name: "Robert E. Horn", works: ["Mapping Great Debates"] },
    title: "Cut fixture",
    subtitle: "",
    issueQuestion: "What disconnects the target?",
    canvas: { width: 800, height: 300, unit: "test", origin: "top-left" },
    regions: [],
    nodes: [node("focus", 1), node("a", 2), node("b", 3), node("join", 4), node("target", 5)],
    relations: [
      { id: "a-focus", kind: "supports", from: "a", to: "focus", label: "supports" },
      { id: "b-focus", kind: "supports", from: "b", to: "focus", label: "supports" },
      { id: "join-a", kind: "supports", from: "join", to: "a", label: "supports" },
      { id: "join-b", kind: "supports", from: "join", to: "b", label: "supports" },
      { id: "target-join", kind: "supports", from: "target", to: "join", label: "supports" },
      ...(direct
        ? [{ id: "target-focus", kind: "supports" as const, from: "target", to: "focus", label: "supports" }]
        : []),
    ],
    citations: [
      { id: "cartographic", layer: "cartographic", citation: "test", short: "test", year: 2026 },
    ],
    readingPath: ["focus", "a", "b", "join", "target"],
    rights: "test fixture",
  };
}

test("minimum cut finds the shared join in a dialogue diamond", () => {
  const result = analyzeHornMinimumCut(fixture(), "focus", "target");
  assert.equal(result.finite, true);
  assert.equal(result.cardinality, 1);
  assert.deepEqual(result.cutNodeIds, ["join"]);
});

test("direct focus-to-target path has no finite internal-node cut", () => {
  const result = analyzeHornMinimumCut(fixture(true), "focus", "target");
  assert.equal(result.finite, false);
  assert.equal(result.cardinality, null);
  assert.deepEqual(result.cutNodeIds, []);
});
