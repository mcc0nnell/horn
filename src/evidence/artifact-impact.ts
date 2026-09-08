import { analyzeHornEvidenceImpact, type HornEvidenceImpactReport } from "./impact";
import {
  evidenceBindingsFromArtifact,
  evidenceImpactQueriesFromArtifact,
  evidenceSnapshotFromArtifact,
  validateHornEvidenceBindingsArtifact,
  validateHornEvidenceImpactRequest,
  validateHornEvidenceSnapshotArtifact,
  type HornEvidenceBindingsArtifact,
  type HornEvidenceImpactRequest,
  type HornEvidenceSnapshotArtifact,
} from "./contracts";
import type { HornDocument } from "../types";

function requireValid<T>(
  value: unknown,
  validate: (candidate: unknown) => Array<{ code: string; message: string }>,
  subject: string,
): T {
  const problems = validate(value);
  if (problems.length > 0) {
    throw new Error(
      `invalid ${subject}: ${problems.map((problem) => `${problem.code}: ${problem.message}`).join("; ")}`,
    );
  }
  return value as T;
}

/**
 * Versioned-artifact entry point for proof-aware evidence impact.
 *
 * Unlike the legacy object adapter, this boundary verifies document identity
 * and ensures every binding in the batch names the supplied evidence snapshot.
 */
export function analyzeHornEvidenceImpactArtifacts(
  document: HornDocument,
  snapshotValue: unknown,
  bindingsValue: unknown,
  requestValue: unknown,
): HornEvidenceImpactReport {
  const snapshotArtifact = requireValid<HornEvidenceSnapshotArtifact>(
    snapshotValue,
    validateHornEvidenceSnapshotArtifact,
    "Horn evidence snapshot",
  );
  const bindingsArtifact = requireValid<HornEvidenceBindingsArtifact>(
    bindingsValue,
    validateHornEvidenceBindingsArtifact,
    "Horn evidence bindings",
  );
  const impactRequest = requireValid<HornEvidenceImpactRequest>(
    requestValue,
    validateHornEvidenceImpactRequest,
    "Horn evidence impact request",
  );

  if (
    bindingsArtifact.document.id !== document.id ||
    bindingsArtifact.document.version !== document.version
  ) {
    throw new Error(
      `evidence bindings target ${bindingsArtifact.document.id} ${bindingsArtifact.document.version}, not ${document.id} ${document.version}`,
    );
  }

  const mismatchedEvidenceIds = bindingsArtifact.bindings
    .map((binding) => binding.evidenceId)
    .filter((evidenceId) => evidenceId !== snapshotArtifact.id);
  if (mismatchedEvidenceIds.length > 0) {
    throw new Error(
      `evidence bindings reference a different snapshot: ${[...new Set(mismatchedEvidenceIds)].sort().join(", ")}`,
    );
  }

  return analyzeHornEvidenceImpact(
    document,
    evidenceSnapshotFromArtifact(snapshotArtifact),
    evidenceBindingsFromArtifact(bindingsArtifact),
    evidenceImpactQueriesFromArtifact(impactRequest),
  );
}
