import { createHash } from "node:crypto";

import type { EvidenceBinding, EvidenceSnapshot } from "../evidence/invalidation.js";
import type { HornDocument } from "../types.js";
import { validateHornDocument } from "../validate.js";
import { toValidationReport } from "../validation-report.js";
import { stringifyNormalized } from "./canonical.js";
import {
  INSPECT_CONTRACT,
  RUNTIME_API_VERSION,
  type ProjectionView,
} from "./constants.js";
import { explainIdentity } from "./explain.js";
import { assessEvidenceImpact } from "./impact.js";
import { projectAnalyticalView } from "./projection.js";
import { runQuery, type QueryRequest } from "./query.js";

export type InspectRequest = {
  projections?: ProjectionView[];
  explainAll?: boolean;
  evidence?: EvidenceSnapshot;
  bindings?: EvidenceBinding[];
  queries?: QueryRequest[];
};

export function sourceDigest(sourceText: string): string {
  return `sha256:${createHash("sha256").update(sourceText, "utf8").digest("hex")}`;
}

export function inspectDocument(
  document: HornDocument,
  sourceText: string,
  request: InspectRequest = {},
): Record<string, unknown> {
  const issues = validateHornDocument(document);
  const validation = toValidationReport(document, issues);
  const projections: Record<string, unknown> = {};
  for (const view of request.projections ?? []) {
    projections[view] = projectAnalyticalView(document, view);
  }

  const explanations: Array<Record<string, unknown>> = [];
  if (request.explainAll) {
    const identities = [
      ...document.nodes.map((node) => node.id),
      ...document.relations.map((relation) => relation.id),
      ...document.citations.map((citation) => citation.id),
      ...document.regions.map((region) => region.id),
    ];
    const support = {
      ...(request.evidence ? { evidence: request.evidence } : {}),
      ...(request.bindings ? { bindings: request.bindings } : {}),
    };
    for (const identity of identities) {
      explanations.push(explainIdentity(document, identity, support));
    }
  }

  const queries = (request.queries ?? []).map((query) =>
    runQuery(document, query),
  );

  const impact =
    request.evidence && request.bindings
      ? assessEvidenceImpact(document, request.evidence, request.bindings)
      : null;

  return {
    explanations,
    impact,
    projections,
    queries,
    runtime: RUNTIME_API_VERSION,
    source: {
      digest: sourceDigest(sourceText),
      documentId: document.id,
      documentVersion: document.version,
    },
    validation,
    version: INSPECT_CONTRACT,
  };
}

export function stringifyInspect(value: Record<string, unknown>): string {
  return stringifyNormalized(value);
}
