import assert from "node:assert/strict";
import test from "node:test";

import { validateHornQueryRequest } from "./query";

test("query validator rejects properties outside the versioned contract", () => {
  const problems = validateHornQueryRequest({
    version: "horn-query-request/0.1",
    operation: "graph",
    focusNodeId: "focus",
    surprise: true,
  });

  assert.ok(problems.some((problem) => problem.code === "unexpected-property"));
});

test("query validator enforces unique relation and suppression identities", () => {
  const problems = validateHornQueryRequest({
    version: "horn-query-request/0.1",
    operation: "counterfactual",
    focusNodeId: "focus",
    relationKinds: ["supports", "supports"],
    suppress: {
      nodeIds: ["reply", "reply"],
      relationIds: ["r1", "r1"],
    },
  });

  assert.equal(
    problems.filter((problem) => problem.code === "duplicate-query-value").length,
    3,
  );
});

test("query validator rejects unexpected suppression properties", () => {
  const problems = validateHornQueryRequest({
    version: "horn-query-request/0.1",
    operation: "counterfactual",
    focusNodeId: "focus",
    suppress: { nodeIds: ["reply"], magic: "nope" },
  });

  assert.ok(problems.some((problem) => problem.code === "unexpected-property"));
});
