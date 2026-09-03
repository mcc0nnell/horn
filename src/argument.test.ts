import assert from "node:assert/strict";
import test from "node:test";

import { type HornArgument, validateHornArgument } from "./argument";

function argumentFixture(): HornArgument {
  return {
    id: "smoke-fire",
    version: "horn-argument/0.1",
    title: "Smoke and fire",
    issueQuestion: "Is there a fire?",
    issueType: "fact",
    sources: [
      {
        id: "source-a",
        citation: "Illustrative argument",
      },
    ],
    claims: [
      {
        id: "position-fire",
        role: "position",
        statement: "There is a fire.",
        sourceIds: ["source-a"],
      },
      {
        id: "grounds-smoke",
        role: "grounds",
        statement: "I see smoke.",
        sourceIds: ["source-a"],
      },
      {
        id: "warrant-smoke-means-fire",
        role: "warrant",
        statement: "Smoke means fire.",
        sourceIds: ["source-a"],
      },
      {
        id: "backing-combustion",
        role: "backing",
        statement: "Combustion commonly produces smoke.",
        sourceIds: ["source-a"],
      },
    ],
    relations: [
      {
        id: "grounds-support-position",
        kind: "supports",
        from: "grounds-smoke",
        to: "position-fire",
        warrantClaimId: "warrant-smoke-means-fire",
      },
      {
        id: "backing-supports-warrant",
        kind: "backs",
        from: "backing-combustion",
        to: "warrant-smoke-means-fire",
      },
    ],
    focusClaimId: "position-fire",
    streams: [
      {
        id: "main",
        focusClaimId: "position-fire",
        claimIds: [
          "position-fire",
          "grounds-smoke",
          "warrant-smoke-means-fire",
          "backing-combustion",
        ],
      },
    ],
  };
}

test("accepts a resolved Horn argument", () => {
  assert.deepEqual(validateHornArgument(argumentFixture()), []);
});

test("rejects references to missing claims", () => {
  const argument = argumentFixture();
  argument.relations.push({
    id: "bad",
    kind: "disputes",
    from: "missing",
    to: "position-fire",
  });

  assert.ok(
    validateHornArgument(argument).some(
      (problem) => problem.code === "unknown-relation-from",
    ),
  );
});

test("requires a stream focus to belong to its stream", () => {
  const argument = argumentFixture();
  argument.streams[0]!.claimIds = ["grounds-smoke"];

  assert.ok(
    validateHornArgument(argument).some(
      (problem) => problem.code === "stream-focus-outside-stream",
    ),
  );
});

test("preserves source provenance as a semantic invariant", () => {
  const argument = argumentFixture();
  argument.claims[0]!.sourceIds = ["missing-source"];

  assert.ok(
    validateHornArgument(argument).some(
      (problem) => problem.code === "unknown-claim-source",
    ),
  );
});

test("requires a support warrant to name a warrant claim", () => {
  const argument = argumentFixture();
  argument.relations[0]!.warrantClaimId = "grounds-smoke";

  assert.ok(
    validateHornArgument(argument).some(
      (problem) => problem.code === "warrant-role-mismatch",
    ),
  );
});

test("requires backing to point from backing to warrant", () => {
  const argument = argumentFixture();
  argument.relations[1]!.from = "grounds-smoke";

  assert.ok(
    validateHornArgument(argument).some(
      (problem) => problem.code === "backing-role-mismatch",
    ),
  );
});
