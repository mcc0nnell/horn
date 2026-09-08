import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { HornDocument } from "../types.js";
import { stringifyNormalized } from "./canonical.js";
import { applyCounterfactual, runQuery } from "./query.js";

const document = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../maps/chinese-room-slice.horn.json", import.meta.url)),
    "utf8",
  ),
) as HornDocument;

test("node and relation lookup are identity-stable", () => {
  const node = runQuery(document, { op: "node-lookup", id: "c5-chinese-room" });
  const relation = runQuery(document, { op: "relation-lookup", id: "r-c6-c1" });
  assert.equal(node.ok, true);
  assert.equal((node.node as { id: string }).id, "c5-chinese-room");
  assert.equal(relation.ok, true);
  assert.equal((relation.relation as { kind: string }).kind, "disputes");
});

test("neighborhood preserves document relation order", () => {
  const result = runQuery(document, {
    op: "neighborhood",
    id: "c1-machines-can-think",
  });
  const inbound = result.inbound as Array<{ id: string }>;
  const outbound = result.outbound as Array<{ id: string }>;
  const expectedInbound = document.relations
    .filter((relation) => relation.to === "c1-machines-can-think")
    .map((relation) => relation.id);
  const expectedOutbound = document.relations
    .filter((relation) => relation.from === "c1-machines-can-think")
    .map((relation) => relation.id);
  assert.deepEqual(
    inbound.map((item) => item.id),
    expectedInbound,
  );
  assert.deepEqual(
    outbound.map((item) => item.id),
    expectedOutbound,
  );
});

test("descendants follow reader-facing responses from a focus claim", () => {
  const result = runQuery(document, {
    op: "descendants",
    id: "c1-machines-can-think",
  });
  const nodeIds = result.nodeIds as string[];
  assert.equal(nodeIds[0], "c1-machines-can-think");
  assert.ok(nodeIds.includes("c5-chinese-room"));
});

test("support-path and challenge-path stay inside existing relation kinds", () => {
  const support = runQuery(document, {
    op: "support-path",
    id: "c1-machines-can-think",
  });
  const challenge = runQuery(document, {
    op: "challenge-path",
    id: "c1-machines-can-think",
  });
  const supportKinds = new Set(
    ((support.inbound as Array<{ kind: string }>).concat(
      support.outbound as Array<{ kind: string }>,
    )).map((item) => item.kind),
  );
  const challengeKinds = new Set(
    ((challenge.inbound as Array<{ kind: string }>).concat(
      challenge.outbound as Array<{ kind: string }>,
    )).map((item) => item.kind),
  );
  for (const kind of supportKinds) {
    assert.equal(kind, "supports");
  }
  for (const kind of challengeKinds) {
    assert.equal(kind, "disputes");
  }
});

test("orphans and evidence-bound queries use stable ordering", () => {
  const orphans = runQuery(document, { op: "orphans" });
  const bound = runQuery(document, { op: "evidence-bound" });
  const orphanNodes = orphans.unreferencedNodes as string[];
  const citations = bound.citations as Array<{ citationId: string }>;
  assert.deepEqual(orphanNodes, [...orphanNodes].sort());
  assert.deepEqual(
    citations.map((item) => item.citationId),
    [...citations.map((item) => item.citationId)].sort(),
  );
});

test("counterfactual analysis does not mutate the source artifact", () => {
  const before = structuredClone(document);
  const result = runQuery(document, {
    op: "counterfactual",
    suppress: { nodes: ["c5-chinese-room"], relations: [], evidenceBindings: [] },
  });
  assert.equal(result.sourceMutated, false);
  assert.equal(result.ok, true);
  assert.deepEqual(document, before);
  const hypothetical = applyCounterfactual(document, {
    op: "counterfactual",
    suppress: { nodes: ["c5-chinese-room"] },
  });
  assert.equal(
    hypothetical.nodes.some((node) => node.id === "c5-chinese-room"),
    false,
  );
  assert.deepEqual(document, before);
  assert.ok((result.disconnectedIds as string[]).length >= 0);
});

test("query results stringify with normalized key order", () => {
  const result = runQuery(document, { op: "frontier" });
  const text = stringifyNormalized(result);
  assert.equal(text, stringifyNormalized(JSON.parse(text)));
});
