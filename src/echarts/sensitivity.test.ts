import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgument } from "../argument";
import {
  analyzeHornArgumentSensitivity,
  analyzeHornArgumentStreamSensitivity,
  rankHornArgumentStreamFragility,
} from "./sensitivity";

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
    { id: "s1", title: "fragile", focusClaimId: "c1", claimIds: ["c1", "c2", "c3", "c4"] },
    { id: "s2", title: "shallow", focusClaimId: "c1", claimIds: ["c1", "c5"] },
  ],
};

test("sensitivity ranks structural articulation and inversion reach without belief scoring", () => {
  const analysis = analyzeHornArgumentSensitivity(argument);
  const c2 = analysis.claims.find((claim) => claim.claimId === "c2");
  const c5 = analysis.claims.find((claim) => claim.claimId === "c5");

  assert.ok(c2);
  assert.equal(c2.removalCascadeCount, 2);
  assert.deepEqual(new Set(c2.removalCascadeClaimIds), new Set(["c3", "c4"]));
  assert.equal(c2.inversionCascadeCount, 2);
  assert.deepEqual(new Set(c2.inversionCascadeClaimIds), new Set(["c3", "c4"]));
  assert.equal(c2.articulationToFocus, true);
  assert.equal(c2.structuralLeverage, 2);

  assert.ok(c5);
  assert.equal(c5.removalCascadeCount, 0);
  assert.equal(c5.inversionCascadeCount, 0);
  assert.equal(c5.structuralLeverage, 0);
  assert.equal(analysis.leverageRanking[0]?.claimId, "c2");
  assert.deepEqual(analysis.articulationClaimIds, ["c2"]);
});

test("sensitivity respects the active issue stream", () => {
  const analysis = analyzeHornArgumentSensitivity(argument, argument.streams[0]?.claimIds);
  assert.equal(analysis.claims.some((claim) => claim.claimId === "c5"), false);
  assert.equal(analysis.leverageRanking[0]?.claimId, "c2");
});

test("stream fragility ranks the deeper articulation-bearing stream first", () => {
  const summaries = analyzeHornArgumentStreamSensitivity(argument);
  const ranked = rankHornArgumentStreamFragility(summaries);

  assert.equal(ranked[0]?.streamId, "s1");
  assert.equal(ranked[0]?.articulationCount, 1);
  assert.equal(ranked[0]?.maxRemovalCascade, 2);
  assert.equal(ranked[0]?.maxInversionCascade, 2);
  assert.equal(ranked[1]?.streamId, "s2");
  assert.equal(ranked[1]?.maxStructuralLeverage, 0);
});

test("stream sensitivity marks streams without the argument focus as unanalyzable", () => {
  const isolated: HornArgument = {
    ...argument,
    streams: [
      ...argument.streams,
      { id: "s3", title: "local only", focusClaimId: "c3", claimIds: ["c3", "c4"] },
    ],
  };
  const summary = analyzeHornArgumentStreamSensitivity(isolated).find(
    (stream) => stream.streamId === "s3",
  );
  assert.ok(summary);
  assert.equal(summary.analyzable, false);
});
