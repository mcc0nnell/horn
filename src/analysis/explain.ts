import type { HornArgument } from "../argument.js";
import type { EvidenceBinding, EvidenceSnapshot } from "../evidence/invalidation.js";
import { invalidateChangedEvidence } from "../evidence/invalidation.js";
import type { HornExtraction } from "../extraction.js";
import type { HornDocument } from "../types.js";
import { stringifyNormalized } from "./canonical.js";
import {
  DOCUMENT_CONTRACT,
  EXPLANATION_CONTRACT,
  RUNTIME_API_VERSION,
} from "./constants.js";
import {
  allFocusThreads,
  citationById,
  inboundRelations,
  nodeById,
  outboundRelations,
  quotedCitation,
  quotedNode,
  quotedRelation,
  relationById,
} from "./graph.js";
import { projectAnalyticalView } from "./projection.js";

export type ExplanationSupport = {
  argument?: HornArgument;
  extraction?: HornExtraction;
  evidence?: EvidenceSnapshot;
  bindings?: EvidenceBinding[];
};

export function explainIdentity(
  document: HornDocument,
  identity: string,
  support: ExplanationSupport = {},
): Record<string, unknown> {
  const nodes = nodeById(document);
  const relations = relationById(document);
  const citations = citationById(document);
  const region = document.regions.find((item) => item.id === identity);

  const base = {
    documentId: document.id,
    documentVersion: DOCUMENT_CONTRACT,
    identity,
    runtime: RUNTIME_API_VERSION,
    version: EXPLANATION_CONTRACT,
  };

  if (nodes.has(identity)) {
    return explainNode(document, identity, support, base);
  }
  if (relations.has(identity)) {
    return explainRelation(document, identity, support, base);
  }
  if (citations.has(identity)) {
    return explainCitation(document, identity, support, base);
  }
  if (region) {
    return {
      ...base,
      kind: "region",
      object: { id: region.id, label: region.label },
      ok: true,
    };
  }
  return {
    ...base,
    error: { code: "E_IDENTITY_NOT_FOUND", message: `unknown identity ${identity}` },
    kind: "unknown",
    ok: false,
  };
}

function staleForNodes(
  support: ExplanationSupport,
  nodeIds: string[],
): Record<string, unknown>[] {
  if (!support.evidence || !support.bindings) {
    return [];
  }
  const invalidations = invalidateChangedEvidence(
    support.evidence,
    support.bindings,
  );
  const wanted = new Set(nodeIds);
  return invalidations
    .filter((item) => item.staleNodeIds.some((id) => wanted.has(id)))
    .map((item) => ({
      evidenceId: item.evidenceId,
      expectedFingerprint: item.expectedFingerprint,
      observedFingerprint: item.observedFingerprint,
      rationale: item.rationale,
      staleNodeIds: [...item.staleNodeIds].sort(),
    }));
}

function projectionPresence(document: HornDocument, nodeId: string) {
  const argument = projectAnalyticalView(document, "argument");
  const timeline = projectAnalyticalView(document, "timeline");
  const evidence = projectAnalyticalView(document, "evidence");
  const frontier = projectAnalyticalView(document, "frontier");
  const threads = allFocusThreads(document);
  const frontierFacts = threads
    .filter((thread) => thread.steps.some((step) => step.nodeId === nodeId))
    .map((thread) => ({
      focusNodeId: thread.focusNodeId,
      frontier: thread.frontierNodeIds.includes(nodeId),
    }));
  return {
    argument: argument.nodes.includes(nodeId),
    evidence: evidence.nodes.includes(nodeId),
    frontier: frontierFacts,
    inFrontierProjection: frontier.nodes.includes(nodeId),
    timeline: timeline.nodes.includes(nodeId),
  };
}

function extractionContributions(
  identity: string,
  support: ExplanationSupport,
): Record<string, unknown>[] {
  if (!support.extraction) {
    return [];
  }
  return support.extraction.decisions
    .filter((decision) => decision.claimId === identity)
    .map((decision) => ({
      candidateId: decision.candidateId,
      claimId: decision.claimId,
      decision: decision.decision,
      reason: decision.reason,
    }));
}

function explainNode(
  document: HornDocument,
  identity: string,
  support: ExplanationSupport,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const node = nodeById(document).get(identity);
  if (!node) {
    return { ...base, ok: false };
  }
  const citations = citationById(document);
  const warrantRoads = document.relations
    .filter(
      (relation) =>
        relation.kind === "warrants" &&
        (relation.from === identity || relation.to === identity),
    )
    .map(quotedRelation);
  const licensedSupports =
    support.argument?.relations
      .filter(
        (relation) =>
          relation.kind === "supports" &&
          (relation.from === identity ||
            relation.to === identity ||
            relation.warrantClaimId === identity),
      )
      .map((relation) => ({
        from: relation.from,
        id: relation.id,
        to: relation.to,
        warrantClaimId: relation.warrantClaimId,
      })) ?? [];
  const semanticClaim = support.argument?.claims.find(
    (claim) => claim.id === identity,
  );

  return {
    ...base,
    evidence: {
      bindings: (support.bindings ?? [])
        .filter((binding) => binding.nodeIds.includes(identity))
        .map((binding) => ({
          evidenceId: binding.evidenceId,
          expectedFingerprint: binding.expectedFingerprint,
          rationale: binding.rationale,
        })),
      citationIds: [...node.citationIds],
    },
    extraction: extractionContributions(identity, support),
    kind: "node",
    object: quotedNode(node),
    ok: true,
    origin: {
      after: document.after ?? null,
      documentAuthority: document.authority,
      nodeOrigin: node.origin,
    },
    projections: projectionPresence(document, identity),
    relations: {
      inbound: inboundRelations(document, identity).map(quotedRelation),
      outbound: outboundRelations(document, identity).map(quotedRelation),
    },
    semantic: semanticClaim
      ? {
          origin: semanticClaim.origin ?? null,
          role: semanticClaim.role,
          sourceIds: [...semanticClaim.sourceIds],
          statement: semanticClaim.statement,
        }
      : null,
    sources: node.citationIds
      .map((id) => citations.get(id))
      .filter((citation) => citation !== undefined)
      .map(quotedCitation),
    stale: staleForNodes(support, [identity]),
    warrants: {
      licensedSupports,
      roads: warrantRoads,
    },
  };
}

function explainRelation(
  document: HornDocument,
  identity: string,
  support: ExplanationSupport,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const relation = relationById(document).get(identity);
  if (!relation) {
    return { ...base, ok: false };
  }
  const semantic = support.argument?.relations.find(
    (item) => item.id === identity,
  );
  const warrant =
    semantic?.warrantClaimId !== undefined
      ? support.argument?.claims.find(
          (claim) => claim.id === semantic.warrantClaimId,
        )
      : undefined;
  return {
    ...base,
    kind: "relation",
    object: quotedRelation(relation),
    ok: true,
    semantic: semantic
      ? {
          from: semantic.from,
          kind: semantic.kind,
          to: semantic.to,
          warrantClaimId: semantic.warrantClaimId ?? null,
        }
      : null,
    stale: staleForNodes(support, [relation.from, relation.to]),
    warrant: warrant
      ? { id: warrant.id, role: warrant.role, statement: warrant.statement }
      : null,
  };
}

function explainCitation(
  document: HornDocument,
  identity: string,
  support: ExplanationSupport,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const citation = citationById(document).get(identity);
  if (!citation) {
    return { ...base, ok: false };
  }
  const boundNodes = document.nodes
    .filter((node) => node.citationIds.includes(identity))
    .map((node) => node.id);
  return {
    ...base,
    boundNodeIds: boundNodes,
    kind: "citation",
    object: quotedCitation(citation),
    ok: true,
    stale: staleForNodes(support, boundNodes),
  };
}

export function stringifyExplanation(value: Record<string, unknown>): string {
  return stringifyNormalized(value);
}
