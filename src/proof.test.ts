import assert from "node:assert/strict";
import test from "node:test";

import {
  createHornQueryProof,
  deriveHornQueryDependencies,
  verifyHornQueryProof,
} from "./proof";
import type { HornDocument } from "./types";

const document: HornDocument = {
  id: "horn:test:proof",
  version: "horn-document/0.1",
  vocabulary: ["argumentation"],
  unitSize: "concept-diagram",
  authority: "authored",
  after: { name: "Robert E. Horn", works: ["Mapping Great Debates"] },
  title: "Proof fixture",
  subtitle: "",
  issueQuestion: "Can this result be replayed?",
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
      text: "not in the dialogue",
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

const request = {
  version: "horn-query-request/0.1" as const,
  operation: "dominators" as const,
  focusNodeId: "focus",
  targetNodeId: "tail",
};

test("Horn query proof is content-addressed and replays cleanly", () => {
  const proof = createHornQueryProof(document, request);
  const second = createHornQueryProof(structuredClone(document), {
    targetNodeId: "tail",
    focusNodeId: "focus",
    operation: "dominators",
    version: "horn-query-request/0.1",
  });

  assert.match(proof.id, /^horn-proof:[0-9a-f]{64}$/);
  assert.equal(second.id, proof.id);
  assert.deepEqual(verifyHornQueryProof(document, proof), {
    version: "horn-proof-verification/0.1",
    proofId: proof.id,
    sourceDocumentId: document.id,
    ok: true,
    issues: [],
  });
});

test("dependency witness excludes relation kinds the query did not consult", () => {
  const dependencies = deriveHornQueryDependencies(document, request);

  assert.deepEqual(
    dependencies.relations.map((relation) => relation.id),
    ["reply-focus", "tail-reply"],
  );
  assert.equal(dependencies.nodes.some((node) => node.id === "note"), false);
});

test("tampered answer fails replay", () => {
  const proof = createHornQueryProof(document, request);
  const tampered = structuredClone(proof);
  tampered.result.result["strictDominatorNodeIds"] = [];

  const report = verifyHornQueryProof(document, tampered);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "result-mismatch"));
});

test("irrelevant cartographic change invalidates exact source digest but preserves dependency digest", () => {
  const proof = createHornQueryProof(document, request);
  const changed = structuredClone(document);
  changed.nodes.find((node) => node.id === "note")!.geometry.x += 10;

  const changedDependencies = deriveHornQueryDependencies(changed, request);
  assert.equal(changedDependencies.canonicalSha256, proof.dependencies.canonicalSha256);

  const report = verifyHornQueryProof(changed, proof);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "source-digest-mismatch"));
  assert.equal(
    report.issues.some((issue) => issue.code === "dependency-digest-mismatch"),
    false,
  );
});

test("structural relation change invalidates the dependency witness", () => {
  const proof = createHornQueryProof(document, request);
  const changed = structuredClone(document);
  changed.relations.find((relation) => relation.id === "tail-reply")!.kind = "addresses";

  const report = verifyHornQueryProof(changed, proof);
  assert.equal(report.ok, false);
  assert.ok(
    report.issues.some((issue) => issue.code === "dependency-digest-mismatch"),
  );
});
