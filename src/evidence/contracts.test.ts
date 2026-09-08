import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { analyzeHornEvidenceImpactArtifacts } from "./artifact-impact";
import {
  fingerprintHornEvidenceArtifact,
  validateHornEvidenceBindingsArtifact,
  validateHornEvidenceImpactRequest,
  validateHornEvidenceSnapshotArtifact,
  type HornEvidenceBindingsArtifact,
  type HornEvidenceSnapshotArtifact,
} from "./contracts";
import type { HornDocument } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../..");

function json(path: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as unknown;
}

const snapshotPath = "experiments/celix-845/evidence/sbom-physical-evidence.horn.json";
const bindingsPath = "experiments/celix-845/evidence/bindings.horn.json";
const requestPath = "experiments/celix-845/evidence/impact-request.horn.json";
const documentPath = "maps/celix-845-specimen-001.horn.json";

test("versioned Celix evidence artifacts satisfy their reference validators", () => {
  assert.deepEqual(validateHornEvidenceSnapshotArtifact(json(snapshotPath)), []);
  assert.deepEqual(validateHornEvidenceBindingsArtifact(json(bindingsPath)), []);
  assert.deepEqual(validateHornEvidenceImpactRequest(json(requestPath)), []);
});

test("versioned snapshot preserves the legacy evidence fingerprint substrate", () => {
  const snapshot = json(snapshotPath);
  const bindings = json(bindingsPath) as HornEvidenceBindingsArtifact;

  assert.equal(
    fingerprintHornEvidenceArtifact(snapshot),
    bindings.bindings[0]?.expectedFingerprint,
  );
});

test("artifact impact boundary reports current evidence as not stale", () => {
  const report = analyzeHornEvidenceImpactArtifacts(
    json(documentPath) as HornDocument,
    json(snapshotPath),
    json(bindingsPath),
    json(requestPath),
  );

  assert.deepEqual(report.staleNodeIds, []);
  assert.ok(report.queryImpacts.every((impact) => impact.affected === false));
});

test("artifact impact boundary reports drift against the same versioned snapshot identity", () => {
  const document = json(documentPath) as HornDocument;
  const changed = structuredClone(json(snapshotPath)) as HornEvidenceSnapshotArtifact;
  changed.substrate.components["openssl"] = "3.7.0";

  const report = analyzeHornEvidenceImpactArtifacts(
    document,
    changed,
    json(bindingsPath),
    json(requestPath),
  );

  assert.deepEqual(report.staleNodeIds, ["c3-package-bound"]);
  assert.equal(
    report.queryImpacts.some(
      (impact) =>
        impact.affected && impact.staleDependencyNodeIds.includes("c3-package-bound"),
    ),
    true,
  );
});

test("artifact impact boundary refuses bindings for a different Horn document", () => {
  const bindings = structuredClone(json(bindingsPath)) as HornEvidenceBindingsArtifact;
  bindings.document.id = "horn:other-document";

  assert.throws(
    () =>
      analyzeHornEvidenceImpactArtifacts(
        json(documentPath) as HornDocument,
        json(snapshotPath),
        bindings,
        json(requestPath),
      ),
    /evidence bindings target horn:other-document/,
  );
});
