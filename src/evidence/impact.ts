import {
  fingerprintEvidence,
  invalidateChangedEvidence,
  type EvidenceBinding,
  type EvidenceSnapshot,
  type Invalidation,
} from "./invalidation";
import { createHornQueryProof } from "../proof";
import type { HornQueryRequest } from "../query";
import type { HornDocument } from "../types";

export type HornEvidenceQueryImpact = {
  requestIndex: number;
  operation: HornQueryRequest["operation"];
  focusNodeId: string;
  targetNodeId?: string;
  proofId: string;
  dependencySha256: string;
  affected: boolean;
  staleDependencyNodeIds: string[];
};

export type HornEvidenceImpactReport = {
  version: "horn-evidence-impact/0.1";
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
  };
  evidence: {
    observedFingerprint: string;
    invalidations: Invalidation[];
  };
  staleNodeIds: string[];
  unknownBoundNodeIds: string[];
  queryImpacts: HornEvidenceQueryImpact[];
};

function nodeOrder(document: HornDocument): Map<string, number> {
  return new Map(
    [...document.nodes]
      .sort((left, right) => left.number - right.number || left.id.localeCompare(right.id))
      .map((node, index) => [node.id, index]),
  );
}

function sortNodeIds(document: HornDocument, ids: Iterable<string>): string[] {
  const order = nodeOrder(document);
  return [...new Set(ids)].sort(
    (left, right) =>
      (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right),
  );
}

function normalizeInvalidations(
  document: HornDocument,
  invalidations: Invalidation[],
): Invalidation[] {
  return invalidations
    .map((invalidation) => ({
      ...invalidation,
      staleNodeIds: sortNodeIds(document, invalidation.staleNodeIds),
    }))
    .sort((left, right) =>
      left.evidenceId === right.evidenceId
        ? left.expectedFingerprint.localeCompare(right.expectedFingerprint)
        : left.evidenceId.localeCompare(right.evidenceId),
    );
}

/**
 * Overlay physical-evidence invalidation onto deterministic Horn query proofs.
 *
 * This does not mutate the Horn document and does not make an affected query
 * structurally false. It says that one or more nodes consulted by that query
 * are backed by evidence whose observed fingerprint no longer matches the
 * recorded expectation.
 */
export function analyzeHornEvidenceImpact(
  document: HornDocument,
  snapshot: EvidenceSnapshot,
  bindings: EvidenceBinding[],
  requests: readonly HornQueryRequest[],
): HornEvidenceImpactReport {
  const invalidations = normalizeInvalidations(
    document,
    invalidateChangedEvidence(snapshot, bindings),
  );
  const staleNodeIds = sortNodeIds(
    document,
    invalidations.flatMap((invalidation) => invalidation.staleNodeIds),
  );
  const staleSet = new Set(staleNodeIds);
  const knownNodeIds = new Set(document.nodes.map((node) => node.id));
  const unknownBoundNodeIds = staleNodeIds
    .filter((nodeId) => !knownNodeIds.has(nodeId))
    .sort();

  const queryImpacts = requests.map<HornEvidenceQueryImpact>((request, requestIndex) => {
    const proof = createHornQueryProof(document, request);
    const staleDependencyNodeIds = proof.dependencies.nodes
      .map((node) => node.id)
      .filter((nodeId) => staleSet.has(nodeId));

    return {
      requestIndex,
      operation: request.operation,
      focusNodeId: request.focusNodeId,
      ...(request.targetNodeId ? { targetNodeId: request.targetNodeId } : {}),
      proofId: proof.id,
      dependencySha256: proof.dependencies.canonicalSha256,
      affected: staleDependencyNodeIds.length > 0,
      staleDependencyNodeIds,
    };
  });

  return {
    version: "horn-evidence-impact/0.1",
    source: {
      documentId: document.id,
      documentVersion: document.version,
    },
    evidence: {
      observedFingerprint: fingerprintEvidence(snapshot),
      invalidations,
    },
    staleNodeIds,
    unknownBoundNodeIds,
    queryImpacts,
  };
}
