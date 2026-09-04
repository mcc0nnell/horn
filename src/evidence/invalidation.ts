import { createHash } from "node:crypto";

export type EvidenceSnapshot = {
  components: Record<string, string>;
  dependencyGraph: Record<string, string[]>;
};

export type EvidenceBinding = {
  evidenceId: string;
  nodeIds: string[];
  expectedFingerprint: string;
  rationale: string;
};

export type Invalidation = {
  evidenceId: string;
  expectedFingerprint: string;
  observedFingerprint: string;
  staleNodeIds: string[];
  rationale: string;
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

export function fingerprintEvidence(snapshot: EvidenceSnapshot): string {
  const canonical = JSON.stringify(
    stable({
      components: snapshot.components,
      dependencyGraph: Object.fromEntries(
        Object.entries(snapshot.dependencyGraph).map(([key, dependencies]) => [
          key,
          [...dependencies].sort(),
        ]),
      ),
    }),
  );
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function invalidateChangedEvidence(
  snapshot: EvidenceSnapshot,
  bindings: EvidenceBinding[],
): Invalidation[] {
  const observedFingerprint = fingerprintEvidence(snapshot);
  return bindings
    .filter((binding) => binding.expectedFingerprint !== observedFingerprint)
    .map((binding) => ({
      evidenceId: binding.evidenceId,
      expectedFingerprint: binding.expectedFingerprint,
      observedFingerprint,
      staleNodeIds: [...binding.nodeIds],
      rationale: binding.rationale,
    }));
}
