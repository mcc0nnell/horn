import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgument } from "../argument";
import { analyzeHornArgumentRedundancy } from "./redundancy";

const arborescence: HornArgument = {
  id: "tree",
  version: "horn-argument/0.1",
  title: "tree",
  issueQuestion: "tree?",
  issueType: "fact",
  sources: [],
  focusClaimId: "f",
  claims: [
    { id: "f", role: "position", statement: "focus", sourceIds: [] },
    { id: "a", role: "grounds", statement: "a", sourceIds: [] },
    { id: "b", role: "grounds", statement: "b", sourceIds: [] },
    { id: "c", role: "grounds", statement: "c", sourceIds: [] },
  ],
  relations: [
    { id: "ra", kind: "supports", from: "a", to: "f" },
    { id: "rb", kind: "supports", from: "b", to: "a" },
    { id: "rc", kind: "supports", from: "c", to: "a" },
  ],
  streams: [],
};

const twoRoute: HornArgument = {
  id: "two-route",
  version: "horn-argument/0.1",
  title: "two-route",
  issueQuestion: "two-route?",
  issueType: "fact",
  sources: [],
  focusClaimId: "f",
  claims: [
    { id: "f", role: "position", statement: "focus", sourceIds: [] },
    { id: "a", role: "grounds", statement: "a", sourceIds: [] },
    { id: "b", role: "grounds", statement: "b", sourceIds: [] },
    { id: "t", role: "grounds", statement: "two routes", sourceIds: [] },
  ],
  relations: [
    { id: "ra", kind: "supports", from: "a", to: "f" },
    { id: "rb", kind: "supports", from: "b", to: "f" },
    { id: "rta", kind: "supports", from: "t", to: "a" },
    { id: "rtb", kind: "supports", from: "t", to: "b" },
  ],
  streams: [],
};

test("identifies a rooted arborescence and no pair-only cuts", () => {
  const analysis = analyzeHornArgumentRedundancy(arborescence);

  assert.equal(analysis.rootedArborescence, true);
  assert.deepEqual(analysis.directToFocusClaimIds, ["a"]);
  assert.deepEqual(new Set(analysis.singleCutTargetClaimIds), new Set(["b", "c"]));
  assert.deepEqual(analysis.pairCutTargetClaimIds, []);
  assert.deepEqual(analysis.pairCutSets, []);
  assert.deepEqual(analysis.noIntermediaryCutUpTo2ClaimIds, ["a"]);
});

test("finds a minimal two-claim cut when either route survives alone", () => {
  const analysis = analyzeHornArgumentRedundancy(twoRoute);

  assert.equal(analysis.rootedArborescence, false);
  assert.deepEqual(analysis.singleCutTargetClaimIds, []);
  assert.deepEqual(analysis.pairCutTargetClaimIds, ["t"]);
  assert.equal(analysis.pairCutSets.length, 1);
  assert.deepEqual(new Set(analysis.pairCutSets[0]?.claimIds), new Set(["a", "b"]));
  assert.deepEqual(analysis.pairCutSets[0]?.jointOnlyDisconnectedClaimIds, ["t"]);
  assert.equal(analysis.pairCutSets[0]?.jointOnlyCount, 1);
});

test("respects an active visibility lens", () => {
  const analysis = analyzeHornArgumentRedundancy(twoRoute, ["f", "a", "t"]);

  assert.equal(analysis.rootedArborescence, true);
  assert.deepEqual(analysis.pairCutSets, []);
  assert.deepEqual(analysis.singleCutTargetClaimIds, ["t"]);
});
