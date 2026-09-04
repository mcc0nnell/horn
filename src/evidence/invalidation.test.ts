import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  fingerprintEvidence,
  invalidateChangedEvidence,
  type EvidenceBinding,
  type EvidenceSnapshot,
} from "./invalidation";

const evidence = JSON.parse(
  readFileSync(
    new URL("../../experiments/celix-845/evidence/sbom-physical-evidence.json", import.meta.url),
    "utf8",
  ),
) as EvidenceSnapshot;

const bindingFile = JSON.parse(
  readFileSync(
    new URL("../../experiments/celix-845/evidence/bindings.json", import.meta.url),
    "utf8",
  ),
) as { bindings: EvidenceBinding[] };

test("captured Celix evidence matches its bound fingerprint", () => {
  assert.equal(
    fingerprintEvidence(evidence),
    "sha256:9fd2d18e8bd1c1a3ed03c9fefb4f562c2b0a73ebbfbfc5d1c23c0e39a3abc176",
  );
  assert.deepEqual(invalidateChangedEvidence(evidence, bindingFile.bindings), []);
});

test("dependency version drift marks only evidence-bound argument nodes stale", () => {
  const changed: EvidenceSnapshot = {
    components: { ...evidence.components, openssl: "3.7.0" },
    dependencyGraph: evidence.dependencyGraph,
  };

  const invalidations = invalidateChangedEvidence(changed, bindingFile.bindings);
  assert.equal(invalidations.length, 1);
  assert.deepEqual(invalidations[0]?.staleNodeIds, ["c3-package-bound"]);
  assert.ok(!invalidations[0]?.staleNodeIds.includes("c6-safe-default"));
});

test("dependency ordering alone does not create false evidence drift", () => {
  const reordered: EvidenceSnapshot = {
    components: { ...evidence.components },
    dependencyGraph: Object.fromEntries(
      Object.entries(evidence.dependencyGraph).map(([key, dependencies]) => [
        key,
        [...dependencies].reverse(),
      ]),
    ),
  };

  assert.deepEqual(invalidateChangedEvidence(reordered, bindingFile.bindings), []);
});
