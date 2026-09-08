import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgument } from "../argument";
import { analyzeHornArgumentCausality } from "./causal";

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
    { id: "c5", role: "grounds", statement: "unrelated branch", sourceIds: [] },
  ],
  relations: [
    { id: "r2", kind: "supports", from: "c2", to: "c1" },
    { id: "r3", kind: "disputes", from: "c3", to: "c2" },
    { id: "r4", kind: "supports", from: "c4", to: "c2" },
    { id: "r5", kind: "supports", from: "c5", to: "c1" },
  ],
  streams: [
    {
      id: "s1",
      focusClaimId: "c1",
      claimIds: ["c1", "c2", "c3", "c4"],
    },
  ],
};

test("causal lens follows responders and context but excludes unrelated branches", () => {
  const analysis = analyzeHornArgumentCausality(argument, "c2");

  assert.deepEqual(new Set(analysis.responderClaimIds), new Set(["c3", "c4"]));
  assert.deepEqual(new Set(analysis.contextClaimIds), new Set(["c1"]));
  assert.deepEqual(new Set(analysis.causalClaimIds), new Set(["c1", "c2", "c3", "c4"]));
  assert.deepEqual(new Set(analysis.causalRelationIds), new Set(["r2", "r3", "r4"]));
  assert.deepEqual(analysis.whyPath, [
    { relationId: "r2", kind: "supports", from: "c2", to: "c1" },
  ]);
  assert.equal(analysis.reachesFocus, true);
});

test("causal lens respects an active stream", () => {
  const analysis = analyzeHornArgumentCausality(
    argument,
    "c3",
    argument.streams[0]?.claimIds,
  );

  assert.deepEqual(new Set(analysis.causalClaimIds), new Set(["c1", "c2", "c3"]));
  assert.deepEqual(
    analysis.whyPath.map((step) => step.relationId),
    ["r3", "r2"],
  );
});

test("causal lens fails closed when selected claim is hidden", () => {
  assert.throws(
    () => analyzeHornArgumentCausality(argument, "c5", argument.streams[0]?.claimIds),
    /outside causal lens/,
  );
});
