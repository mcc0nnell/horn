import {
  fingerprintEvidence,
  invalidateChangedEvidence,
  type EvidenceBinding,
  type EvidenceSnapshot,
} from "../evidence/invalidation.js";
import type { HornDocument } from "../types.js";
import { stringifyNormalized } from "./canonical.js";
import {
  DOCUMENT_CONTRACT,
  IMPACT_CONTRACT,
  RUNTIME_API_VERSION,
} from "./constants.js";
import { reachable } from "./graph.js";
import { projectAnalyticalView } from "./projection.js";

export type ImpactReport = Record<string, unknown>;

export function assessEvidenceImpact(
  document: HornDocument,
  evidence: EvidenceSnapshot,
  bindings: EvidenceBinding[],
): ImpactReport {
  const observedFingerprint = fingerprintEvidence(evidence);
  const invalidations = invalidateChangedEvidence(evidence, bindings);
  const changed = invalidations.map((item) => ({
    evidenceId: item.evidenceId,
    expectedFingerprint: item.expectedFingerprint,
    observedFingerprint: item.observedFingerprint,
    rationale: item.rationale,
  }));
  const unchanged = bindings
    .filter((binding) => binding.expectedFingerprint === observedFingerprint)
    .map((binding) => ({
      evidenceId: binding.evidenceId,
      fingerprint: observedFingerprint,
    }));

  const directlyStale = [
    ...new Set(invalidations.flatMap((item) => item.staleNodeIds)),
  ].sort();
  const transitively = new Set<string>(directlyStale);
  const transitiveRelations = new Set<string>();
  for (const nodeId of directlyStale) {
    const walked = reachable(document, nodeId, "both");
    for (const id of walked.nodeIds) {
      transitively.add(id);
    }
    for (const id of walked.relationIds) {
      transitiveRelations.add(id);
    }
  }
  const transitivelyAffected = [...transitively]
    .filter((id) => !directlyStale.includes(id))
    .sort();
  const affected = [...transitively].sort();
  const unaffected = document.nodes
    .map((node) => node.id)
    .filter((id) => !transitively.has(id))
    .sort();

  const argument = projectAnalyticalView(document, "argument");
  const timeline = projectAnalyticalView(document, "timeline");
  const evidenceView = projectAnalyticalView(document, "evidence");
  const frontier = projectAnalyticalView(document, "frontier");
  const inSet = (ids: string[]) => ids.filter((id) => transitively.has(id)).sort();

  return {
    affectedProjections: {
      argument: inSet(argument.nodes),
      evidence: inSet(evidenceView.nodes),
      frontier: inSet(frontier.nodes),
      timeline: inSet(timeline.nodes),
    },
    changedFingerprints: changed,
    directlyStale,
    documentId: document.id,
    documentVersion: DOCUMENT_CONTRACT,
    mutatesSource: false,
    observedFingerprint,
    runtime: RUNTIME_API_VERSION,
    transitivelyAffected,
    transitivelyAffectedRelations: [...transitiveRelations].sort(),
    unaffected,
    unchangedFingerprints: unchanged,
    version: IMPACT_CONTRACT,
    affectedIdentities: affected,
  };
}

export function stringifyImpact(report: ImpactReport): string {
  return stringifyNormalized(report);
}
