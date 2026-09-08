import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgument } from "../argument";
import { analyzeHornArgumentCounterfactual } from "./counterfactual";

const argument: HornArgument = {
  id: "fixture",
  version: "horn-argument/0.1",
  title: "fixture",
  issueQuestion: "fixture?",
  issueType: "fact",
  sources: [],
  focusClaimId: "c1",
  claims: [
    { id: "c1", role: "position", statement: "root", sourceIds: [] },
    { id: "c2", role: "grounds", statement: "supports root", sourceIds: [] },
    { id: "c3", role: "rebuttal", statement: "disputes c2", sourceIds: [] },
    { id: "c4", role: "grounds", statement: "supports c2", sourceIds: [] },
    { id: "c5", role: "grounds", statement: "other root branch", sourceIds: [] },
  ],
  relations: [
    { id: "r2", kind: "supports", from: "c2", to: "c1" },
    { id: "r3", kind: "disputes", from: "c3", to: "c2" },
    { id: "r4", kind: "supports", from: "c4", to: "c2" },
    { id: "r5", kind: "supports", from: "c5", to: "c1" },
  ],
  streams: [
    { id: "s1", focusClaimId: "c1", claimIds: ["c1", "c2", "c3", "c4"] },
  ],
};

test("removing a claim reports the responder subtree stranded from the focus", () => {
  const result = analyzeHornArgumentCounterfactual(argument, "c2", "remove");

  assert.deepEqual(new Set(result.affectedClaimIds), new Set(["c2", "c3", "c4"]));
  assert.deepEqual(new Set(result.disconnectedClaimIds), new Set(["c3", "c4"]));
  assert.deepEqual(result.removedClaimIds, ["c2"]);
  assert.equal(result.reachesFocusBefore, true);
  assert.equal(result.reachesFocusAfter, false);
  assert.deepEqual(result.hypotheticalWhyPath, []);
  assert.equal(result.originalMove?.relationId, "r2");
});

test("inverting a move flips only the hypothetical move and marks its responder subtree", () => {
  const result = analyzeHornArgumentCounterfactual(argument, "c2", "invert");

  assert.equal(result.originalMove?.kind, "supports");
  assert.equal(result.hypotheticalMove?.kind, "disputes");
  assert.deepEqual(new Set(result.orientationChangedClaimIds), new Set(["c2", "c3", "c4"]));
  assert.deepEqual(result.affectedRelationIds, ["r2"]);
  assert.equal(result.reachesFocusAfter, true);
  assert.equal(result.hypotheticalWhyPath[0]?.kind, "disputes");
});

test("counterfactuals respect active stream visibility and fail closed for hidden claims", () => {
  const visible = argument.streams[0]?.claimIds;
  const result = analyzeHornArgumentCounterfactual(argument, "c2", "remove", visible);
  assert.equal(result.affectedClaimIds.includes("c5"), false);
  assert.throws(
    () => analyzeHornArgumentCounterfactual(argument, "c5", "remove", visible),
    /outside counterfactual lens/,
  );
});

test("the argument focus cannot be counterfactually rewritten", () => {
  assert.throws(
    () => analyzeHornArgumentCounterfactual(argument, "c1", "remove"),
    /focus cannot be counterfactually/,
  );
});
