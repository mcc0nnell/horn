import assert from "node:assert/strict";
import test from "node:test";

import { executeHornQuery, validateHornQueryRequest } from "./query";
import type { HornDocument } from "./types";

const document: HornDocument = {
  id: "horn:test:query",
  version: "horn-document/0.1",
  vocabulary: ["argumentation"],
  unitSize: "concept-diagram",
  authority: "authored",
  after: { name: "Robert E. Horn", works: ["Mapping Great Debates"] },
  title: "Query fixture",
  subtitle: "",
  issueQuestion: "What follows?",
  canvas: { width: 600, height: 300, unit: "test", origin: "top-left" },
  regions: [],
  nodes: [
    {
      id: "focus",
      number: 1,
      kind: "focus-claim",
      origin: "authored",
      focus: true,
      label: "focus",
      text: "focus",
      geometry: { x: 20, y: 20, w: 100, h: 50 },
      citationIds: ["cartographic"],
    },
    {
      id: "reply",
      number: 2,
      kind: "claim",
      origin: "authored",
      label: "reply",
      text: "reply",
      geometry: { x: 180, y: 20, w: 100, h: 50 },
      citationIds: ["cartographic"],
    },
  ],
  relations: [
    {
      id: "reply-focus",
      kind: "supports",
      from: "reply",
      to: "focus",
      label: "supports",
    },
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
  readingPath: ["focus", "reply"],
  rights: "test fixture",
};

test("query request validation rejects suppression on non-counterfactual operations", () => {
  const problems = validateHornQueryRequest({
    version: "horn-query-request/0.1",
    operation: "graph",
    focusNodeId: "focus",
    suppress: { nodeIds: ["reply"] },
  });

  assert.ok(problems.some((problem) => problem.code === "suppress-on-noncounterfactual"));
});

test("artifact query returns a deterministic graph result", () => {
  const result = executeHornQuery(document, {
    version: "horn-query-request/0.1",
    operation: "graph",
    focusNodeId: "focus",
  });

  assert.equal(result.version, "horn-query-result/0.1");
  assert.equal(result.operation, "graph");
  assert.deepEqual(result.source, {
    documentId: "horn:test:query",
    documentVersion: "horn-document/0.1",
  });
  assert.deepEqual(result.result["nodeIds"], ["focus", "reply"]);
  assert.deepEqual(result.result["frontierNodeIds"], ["reply"]);
});

test("artifact counterfactual reports disconnected structure", () => {
  const result = executeHornQuery(document, {
    version: "horn-query-request/0.1",
    operation: "counterfactual",
    focusNodeId: "focus",
    suppress: { nodeIds: ["reply"] },
  });

  assert.deepEqual(result.result["disconnectedNodeIds"], ["reply"]);
});

test("dominators request requires a target", () => {
  const problems = validateHornQueryRequest({
    version: "horn-query-request/0.1",
    operation: "dominators",
    focusNodeId: "focus",
  });
  assert.ok(problems.some((problem) => problem.code === "missing-target"));
});
