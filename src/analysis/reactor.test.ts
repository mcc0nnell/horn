import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  fingerprintEvidence,
  invalidateChangedEvidence,
  type EvidenceBinding,
  type EvidenceSnapshot,
} from "../evidence/invalidation.js";
import type { HornDocument } from "../types.js";
import { stringifyNormalized } from "./canonical.js";
import type { ProjectionView } from "./constants.js";
import { diffHornDocuments } from "./diff.js";
import { explainIdentity } from "./explain.js";
import { generateFixtureCases } from "./generator.js";
import { assessEvidenceImpact } from "./impact.js";
import { inspectDocument } from "./inspect.js";
import { projectAnalyticalView } from "./projection.js";
import { runQuery } from "./query.js";

const chineseRoomPath = fileURLToPath(
  new URL("../../maps/chinese-room-slice.horn.json", import.meta.url),
);
const chineseRoomText = readFileSync(chineseRoomPath, "utf8");
const chineseRoom = JSON.parse(chineseRoomText) as HornDocument;

const celixPath = fileURLToPath(
  new URL("../../maps/celix-845-specimen-001.horn.json", import.meta.url),
);
const celix = JSON.parse(readFileSync(celixPath, "utf8")) as HornDocument;
const evidence = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../experiments/celix-845/evidence/sbom-physical-evidence.json", import.meta.url),
    ),
    "utf8",
  ),
) as EvidenceSnapshot;
const bindings = (
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../../experiments/celix-845/evidence/bindings.json", import.meta.url),
      ),
      "utf8",
    ),
  ) as { bindings: EvidenceBinding[] }
).bindings;

test("explanation returns structured facts rather than prose", () => {
  const explanation = explainIdentity(chineseRoom, "c1-machines-can-think");
  assert.equal(explanation.ok, true);
  assert.equal(explanation.kind, "node");
  assert.equal(
    JSON.stringify(explanation).includes("I think this means"),
    false,
  );
  assert.ok(Array.isArray((explanation.relations as { inbound: unknown[] }).inbound));
});

test("evidence impact matches TypeScript invalidation and does not rewrite claims", () => {
  const fresh = assessEvidenceImpact(celix, evidence, bindings);
  assert.deepEqual(fresh.directlyStale, []);
  assert.equal(fresh.mutatesSource, false);
  assert.equal(fresh.observedFingerprint, fingerprintEvidence(evidence));

  const changed: EvidenceSnapshot = {
    components: { ...evidence.components, openssl: "3.7.0" },
    dependencyGraph: evidence.dependencyGraph,
  };
  const invalidations = invalidateChangedEvidence(changed, bindings);
  const impact = assessEvidenceImpact(celix, changed, bindings);
  assert.deepEqual(impact.directlyStale, [...invalidations[0]!.staleNodeIds].sort());
  assert.ok((impact.transitivelyAffected as string[]).includes("c2-binary-boundary"));
  assert.equal((impact.directlyStale as string[]).includes("c6-safe-default"), false);
  assert.deepEqual(celix.nodes.find((node) => node.id === "c3-package-bound")?.label, "Bind the SBOM to the deployed Conan graph");
});

test("diff separates authored geometry from derived projections", () => {
  const moved = structuredClone(chineseRoom);
  const node = moved.nodes.find((item) => item.id === "c1-machines-can-think");
  assert.ok(node);
  node.geometry = { ...node.geometry, x: node.geometry.x + 40 };

  const geometryDiff = diffHornDocuments(chineseRoom, moved);
  assert.ok(
    (geometryDiff.authoredGeometry as Array<{ field: string }>).some(
      (change) => change.field === "geometry",
    ),
  );
  const projectionNodes = (
    geometryDiff.projectionConsequences as {
      argument: { nodes: { added: string[]; removed: string[] } };
    }
  ).argument.nodes;
  assert.deepEqual(projectionNodes, { added: [], removed: [] });

  const relabeled = structuredClone(chineseRoom);
  const claim = relabeled.nodes.find((item) => item.id === "c1-machines-can-think");
  assert.ok(claim);
  claim.label = "Machines might think";
  const contentDiff = diffHornDocuments(chineseRoom, relabeled);
  assert.ok(
    (contentDiff.content as Array<{ field: string }>).some(
      (change) => change.field === "label",
    ),
  );
});

test("horn_inspect output is byte-stable for identical inputs", () => {
  const request = {
    projections: ["argument", "timeline", "evidence", "frontier"] as ProjectionView[],
    explainAll: true,
  };
  const first = stringifyNormalized(
    inspectDocument(chineseRoom, chineseRoomText, { ...request }),
  );
  const second = stringifyNormalized(
    inspectDocument(chineseRoom, chineseRoomText, { ...request }),
  );
  assert.equal(first, second);
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(first), false);
});

test("seeded generator is reproducible and includes pathological shapes", () => {
  const first = generateFixtureCases(845);
  const second = generateFixtureCases(845);
  assert.deepEqual(
    first.map((item) => item.name),
    second.map((item) => item.name),
  );
  assert.equal(
    stringifyNormalized(first[3]?.document),
    stringifyNormalized(second[3]?.document),
  );
  const names = new Set(first.map((item) => item.name));
  for (const required of [
    "empty-graph",
    "one-node",
    "disconnected",
    "long-chain",
    "diamond",
    "cycle",
    "duplicate-ids",
    "missing-endpoints",
    "high-fan",
    "large-synthetic",
  ]) {
    assert.ok(names.has(required), `missing ${required}`);
  }

  const valid = first.find((item) => item.name === "diamond")?.document;
  assert.ok(valid);
  const frontier = runQuery(valid, { op: "frontier" });
  assert.equal(frontier.ok, true);
  const argument = projectAnalyticalView(valid, "argument");
  assert.equal(argument.nodes.length, valid.nodes.length);
});
