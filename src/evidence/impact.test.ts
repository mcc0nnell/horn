import assert from "node:assert/strict";
import test from "node:test";

import { fingerprintEvidence, type EvidenceSnapshot } from "./invalidation";
import { analyzeHornEvidenceImpact } from "./impact";
import { createHornQueryProof, verifyHornQueryProof } from "../proof";
import type { HornQueryRequest } from "../query";
import type { HornDocument } from "../types";

const document: HornDocument = {
  id: "horn:test:evidence-impact",
  version: "horn-document/0.1",
  vocabulary: ["argumentation"],
  unitSize: "concept-diagram",
  authority: "authored",
  after: { name: "Robert E. Horn", works: ["Mapping Great Debates"] },
  title: "Evidence impact fixture",
  subtitle: "",
  issueQuestion: "Which analyses touch stale evidence?",
  canvas: { width: 800, height: 300, unit: "test", origin: "top-left" },
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
    {
      id: "tail",
      number: 3,
      kind: "claim",
      origin: "authored",
      label: "tail",
      text: "tail",
      geometry: { x: 340, y: 20, w: 100, h: 50 },
      citationIds: ["cartographic"],
    },
    {
      id: "note",
      number: 4,
      kind: "gloss",
      origin: "authored",
      label: "note",
      text: "note",
      geometry: { x: 500, y: 20, w: 100, h: 50 },
      citationIds: ["cartographic"],
    },
  ],
  relations: [
    { id: "reply-focus", kind: "supports", from: "reply", to: "focus", label: "supports" },
    { id: "tail-reply", kind: "disputes", from: "tail", to: "reply", label: "disputes" },
    { id: "note-focus", kind: "addresses", from: "note", to: "focus", label: "addresses" },
  ],
  citations: [
    { id: "cartographic", layer: "cartographic", citation: "test", short: "test", year: 2026 },
  ],
  readingPath: ["focus", "reply", "tail"],
  rights: "test fixture",
};

const baselineEvidence: EvidenceSnapshot = {
  components: { openssl: "3.6.0" },
  dependencyGraph: { app: ["openssl"] },
};
const changedEvidence: EvidenceSnapshot = {
  components: { openssl: "3.7.0" },
  dependencyGraph: { app: ["openssl"] },
};

const requests: HornQueryRequest[] = [
  {
    version: "horn-query-request/0.1",
    operation: "dominators",
    focusNodeId: "focus",
    targetNodeId: "tail",
  },
  {
    version: "horn-query-request/0.1",
    operation: "graph",
    focusNodeId: "focus",
    relationKinds: ["addresses"],
  },
];

test("evidence change affects only proofs whose structural dependencies touch stale nodes", () => {
  const expectedFingerprint = fingerprintEvidence(baselineEvidence);
  const before = JSON.stringify(document);
  const report = analyzeHornEvidenceImpact(
    document,
    changedEvidence,
    [
      {
        evidenceId: "resolved-dependencies",
        nodeIds: ["reply"],
        expectedFingerprint,
        rationale: "reply describes the captured dependency resolution",
      },
    ],
    requests,
  );

  assert.deepEqual(report.staleNodeIds, ["reply"]);
  assert.equal(report.queryImpacts[0]?.affected, true);
  assert.deepEqual(report.queryImpacts[0]?.staleDependencyNodeIds, ["reply"]);
  assert.equal(report.queryImpacts[1]?.affected, false);
  assert.deepEqual(report.queryImpacts[1]?.staleDependencyNodeIds, []);
  assert.equal(JSON.stringify(document), before);
});

test("evidence impact does not make an unchanged structural proof fail replay", () => {
  const proof = createHornQueryProof(document, requests[0]!);
  const expectedFingerprint = fingerprintEvidence(baselineEvidence);
  const impact = analyzeHornEvidenceImpact(
    document,
    changedEvidence,
    [
      {
        evidenceId: "resolved-dependencies",
        nodeIds: ["reply"],
        expectedFingerprint,
        rationale: "reply describes the captured dependency resolution",
      },
    ],
    [requests[0]!],
  );

  assert.equal(impact.queryImpacts[0]?.affected, true);
  assert.equal(verifyHornQueryProof(document, proof).ok, true);
});

test("unknown stale binding identities remain observable", () => {
  const expectedFingerprint = fingerprintEvidence(baselineEvidence);
  const report = analyzeHornEvidenceImpact(
    document,
    changedEvidence,
    [
      {
        evidenceId: "broken-binding",
        nodeIds: ["missing-node"],
        expectedFingerprint,
        rationale: "fixture intentionally points at an absent identity",
      },
    ],
    [],
  );

  assert.deepEqual(report.unknownBoundNodeIds, ["missing-node"]);
});
