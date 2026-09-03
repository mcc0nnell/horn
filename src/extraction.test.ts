import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgument } from "./argument";
import { type HornExtraction, validateHornExtraction } from "./extraction";

function argumentFixture(): HornArgument {
  return {
    id: "smoke-fire",
    version: "horn-argument/0.1",
    title: "Smoke and fire",
    issueQuestion: "Is there a fire?",
    issueType: "fact",
    sources: [{ id: "source-a", citation: "Illustrative source" }],
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
        statement: "Smoke is visible.",
        sourceIds: ["source-a"],
      },
    ],
    relations: [
      {
        id: "grounds-support-position",
        kind: "supports",
        from: "grounds-smoke",
        to: "position-fire",
      },
    ],
    focusClaimId: "position-fire",
    streams: [
      {
        id: "main",
        focusClaimId: "position-fire",
        claimIds: ["position-fire", "grounds-smoke"],
      },
    ],
  };
}

function extractionFixture(): HornExtraction {
  return {
    id: "smoke-fire-extraction",
    version: "horn-extraction/0.1",
    argumentId: "smoke-fire",
    sources: [{ id: "source-a", locator: "fixture://source-a" }],
    spans: [
      {
        id: "span-1",
        sourceId: "source-a",
        locator: "paragraph:1",
        text: "Smoke is visible. Therefore there is a fire.",
      },
    ],
    candidates: [
      {
        id: "candidate-smoke",
        spanIds: ["span-1"],
        statement: "Smoke is visible.",
        origin: "explicit",
      },
      {
        id: "candidate-fire",
        spanIds: ["span-1"],
        statement: "There is a fire.",
        origin: "explicit",
      },
    ],
    decisions: [
      {
        candidateId: "candidate-smoke",
        decision: "select",
        reason: "A distinct factual ground in the source passage.",
        claimId: "grounds-smoke",
        normalizedStatement: "Smoke is visible.",
      },
      {
        candidateId: "candidate-fire",
        decision: "select",
        reason: "A distinct conclusion in the source passage.",
        claimId: "position-fire",
        normalizedStatement: "There is a fire.",
      },
    ],
  };
}

test("accepts an auditable extraction that resolves into the argument", () => {
  assert.deepEqual(validateHornExtraction(extractionFixture(), argumentFixture()), []);
});

test("requires every candidate to receive an explicit decision", () => {
  const extraction = extractionFixture();
  extraction.decisions.pop();
  assert.ok(
    validateHornExtraction(extraction, argumentFixture()).some(
      (problem) => problem.code === "candidate-without-decision",
    ),
  );
});

test("rejects normalized outputs that drift from the semantic argument", () => {
  const extraction = extractionFixture();
  extraction.decisions[0]!.normalizedStatement = "There might be smoke.";
  assert.ok(
    validateHornExtraction(extraction, argumentFixture()).some(
      (problem) => problem.code === "normalized-statement-mismatch",
    ),
  );
});

test("rejects candidate evidence that points outside the recorded source spans", () => {
  const extraction = extractionFixture();
  extraction.candidates[0]!.spanIds = ["missing-span"];
  assert.ok(
    validateHornExtraction(extraction, argumentFixture()).some(
      (problem) => problem.code === "unknown-candidate-span",
    ),
  );
});
