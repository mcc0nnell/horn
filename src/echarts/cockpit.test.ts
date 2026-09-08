import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgument } from "../argument";
import type { HornArgumentProjectionBundle } from "./argument-bundle";
import { inspectHornArgumentClaim } from "./cockpit";

const argument: HornArgument = {
  id: "example",
  version: "horn-argument/0.1",
  title: "Example",
  issueQuestion: "Can it think?",
  issueType: "fact",
  sources: [{ id: "s1", citation: "Example source" }],
  claims: [
    {
      id: "c1",
      role: "position",
      title: "Position",
      statement: "Yes",
      sourceIds: ["s1"],
      origin: "source-explicit",
      sourceLocator: "Map 1, box 1",
      extensions: { boxNumber: 1, issueId: "root" },
    },
    {
      id: "c2",
      role: "rebuttal",
      title: "Objection",
      statement: "No",
      sourceIds: ["s1"],
      extensions: { boxNumber: 2, attribution: "Critic" },
    },
    {
      id: "c3",
      role: "grounds",
      title: "Reply",
      statement: "But yes",
      sourceIds: ["s1"],
      extensions: { boxNumber: 3 },
    },
  ],
  relations: [
    { id: "r1", kind: "disputes", from: "c2", to: "c1" },
    { id: "r2", kind: "supports", from: "c3", to: "c2" },
  ],
  focusClaimId: "c1",
  streams: [
    { id: "stream-a", title: "A", focusClaimId: "c1", claimIds: ["c1", "c2"] },
    { id: "stream-b", title: "B", focusClaimId: "c1", claimIds: ["c1", "c2", "c3"] },
  ],
};

const bundle: HornArgumentProjectionBundle = {
  version: "horn-echarts-argument-bundle/0.1",
  argument,
};

test("claim inspection exposes provenance, stream membership, and direct semantic neighborhood", () => {
  const inspection = inspectHornArgumentClaim(bundle, "c2");
  assert.equal(inspection.number, 2);
  assert.equal(inspection.attribution, "Critic");
  assert.deepEqual(inspection.streamIds, ["stream-a", "stream-b"]);
  assert.deepEqual(inspection.outgoing, [
    { relationId: "r1", kind: "disputes", claimId: "c1", claimTitle: "Position" },
  ]);
  assert.deepEqual(inspection.incoming, [
    { relationId: "r2", kind: "supports", claimId: "c3", claimTitle: "Reply" },
  ]);
});

test("claim inspection fails closed for unknown claims", () => {
  assert.throws(() => inspectHornArgumentClaim(bundle, "missing"), /unknown Horn argument claim/);
});
