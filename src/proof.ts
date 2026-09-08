import { canonicalJson, canonicalJsonSha256 } from "./canonical-json";
import { hornDialecticalRelationKinds } from "./structure";
import {
  executeHornQuery,
  validateHornQueryRequest,
  type HornQueryRequest,
  type HornQueryResult,
} from "./query";
import type { HornDocument, RelationKind } from "./types";

export type HornQueryDependencyWitness = {
  version: "horn-query-dependencies/0.1";
  nodeFields: ["id", "number"];
  relationFields: ["id", "kind", "from", "to"];
  nodes: Array<{ id: string; number: number }>;
  relations: Array<{
    id: string;
    kind: RelationKind;
    from: string;
    to: string;
  }>;
  canonicalSha256: string;
};

export type HornQueryProof = {
  id: string;
  version: "horn-proof/0.1";
  algorithm: "horn-query-replay/0.1";
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
    canonicalSha256: string;
  };
  request: HornQueryRequest;
  result: HornQueryResult;
  dependencies: HornQueryDependencyWitness;
};

export type HornProofVerificationIssue = {
  code: string;
  message: string;
};

export type HornProofVerification = {
  version: "horn-proof-verification/0.1";
  proofId: string | null;
  sourceDocumentId: string;
  ok: boolean;
  issues: HornProofVerificationIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableNodeOrder(document: HornDocument): Map<string, number> {
  return new Map(
    [...document.nodes]
      .sort((left, right) => left.number - right.number || left.id.localeCompare(right.id))
      .map((node, index) => [node.id, index]),
  );
}

function requireQueryRequest(value: unknown): HornQueryRequest {
  const problems = validateHornQueryRequest(value);
  if (problems.length > 0) {
    throw new Error(
      `invalid Horn proof query request: ${problems
        .map((problem) => `${problem.code}: ${problem.message}`)
        .join("; ")}`,
    );
  }
  return value as HornQueryRequest;
}

/**
 * Capture the structural fields consulted by the current deterministic query
 * reference. The full document digest binds the exact source artifact; this
 * smaller witness makes it observable whether a source change touched fields
 * that the query engine actually consults.
 */
export function deriveHornQueryDependencies(
  document: HornDocument,
  requestValue: unknown,
): HornQueryDependencyWitness {
  const request = requireQueryRequest(requestValue);
  const relationKinds = new Set<RelationKind>(
    request.relationKinds ?? hornDialecticalRelationKinds,
  );
  const relationIds = new Set(request.suppress?.relationIds ?? []);
  const nodeIds = new Set<string>([
    request.focusNodeId,
    ...(request.targetNodeId ? [request.targetNodeId] : []),
    ...(request.suppress?.nodeIds ?? []),
  ]);

  const relations = document.relations
    .filter(
      (relation) => relationKinds.has(relation.kind) || relationIds.has(relation.id),
    )
    .map((relation) => {
      nodeIds.add(relation.from);
      nodeIds.add(relation.to);
      return {
        id: relation.id,
        kind: relation.kind,
        from: relation.from,
        to: relation.to,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const order = stableNodeOrder(document);
  const nodes = document.nodes
    .filter((node) => nodeIds.has(node.id))
    .map((node) => ({ id: node.id, number: node.number }))
    .sort(
      (left, right) =>
        (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );

  const witnessCore = {
    version: "horn-query-dependencies/0.1" as const,
    nodeFields: ["id", "number"] as ["id", "number"],
    relationFields: ["id", "kind", "from", "to"] as [
      "id",
      "kind",
      "from",
      "to",
    ],
    nodes,
    relations,
  };

  return {
    ...witnessCore,
    canonicalSha256: canonicalJsonSha256(witnessCore),
  };
}

function proofCore(proof: Omit<HornQueryProof, "id">): Omit<HornQueryProof, "id"> {
  return proof;
}

export function createHornQueryProof(
  document: HornDocument,
  requestValue: unknown,
): HornQueryProof {
  const request = requireQueryRequest(requestValue);
  const result = executeHornQuery(document, request);
  const dependencies = deriveHornQueryDependencies(document, request);

  const core = proofCore({
    version: "horn-proof/0.1",
    algorithm: "horn-query-replay/0.1",
    source: {
      documentId: document.id,
      documentVersion: document.version,
      canonicalSha256: canonicalJsonSha256(document),
    },
    request,
    result,
    dependencies,
  });

  return {
    id: `horn-proof:${canonicalJsonSha256(core)}`,
    ...core,
  };
}

function comparePart(
  issues: HornProofVerificationIssue[],
  code: string,
  message: string,
  expected: unknown,
  actual: unknown,
): void {
  try {
    if (canonicalJson(expected) !== canonicalJson(actual)) {
      issues.push({ code, message });
    }
  } catch {
    issues.push({ code, message });
  }
}

export function verifyHornQueryProof(
  document: HornDocument,
  proofValue: unknown,
): HornProofVerification {
  const issues: HornProofVerificationIssue[] = [];
  const proofId =
    isRecord(proofValue) && typeof proofValue.id === "string" ? proofValue.id : null;

  if (!isRecord(proofValue)) {
    return {
      version: "horn-proof-verification/0.1",
      proofId,
      sourceDocumentId: document.id,
      ok: false,
      issues: [{ code: "invalid-proof", message: "Horn proof must be an object" }],
    };
  }

  if (proofValue.version !== "horn-proof/0.1") {
    issues.push({ code: "version", message: "unsupported Horn proof version" });
  }
  if (proofValue.algorithm !== "horn-query-replay/0.1") {
    issues.push({ code: "algorithm", message: "unsupported Horn proof algorithm" });
  }
  if (!isRecord(proofValue.source)) {
    issues.push({ code: "invalid-source", message: "Horn proof needs source metadata" });
  }
  if (!isRecord(proofValue.request)) {
    issues.push({ code: "invalid-request", message: "Horn proof needs a query request" });
  }
  if (!isRecord(proofValue.result)) {
    issues.push({ code: "invalid-result", message: "Horn proof needs a query result" });
  }
  if (!isRecord(proofValue.dependencies)) {
    issues.push({
      code: "invalid-dependencies",
      message: "Horn proof needs a dependency witness",
    });
  }

  if (issues.length === 0) {
    try {
      const expected = createHornQueryProof(document, proofValue.request);
      const source = proofValue.source as Record<string, unknown>;
      const dependencies = proofValue.dependencies as Record<string, unknown>;

      if (source.documentId !== document.id || source.documentVersion !== document.version) {
        issues.push({
          code: "source-identity-mismatch",
          message: "proof source identity does not match the supplied Horn document",
        });
      }
      if (source.canonicalSha256 !== expected.source.canonicalSha256) {
        issues.push({
          code: "source-digest-mismatch",
          message: "canonical Horn document digest does not match the proof",
        });
      }
      if (dependencies.canonicalSha256 !== expected.dependencies.canonicalSha256) {
        issues.push({
          code: "dependency-digest-mismatch",
          message: "query dependency witness digest does not match",
        });
      }

      comparePart(
        issues,
        "dependency-witness-mismatch",
        "query dependency witness does not replay exactly",
        expected.dependencies,
        proofValue.dependencies,
      );
      comparePart(
        issues,
        "result-mismatch",
        "query result does not replay exactly",
        expected.result,
        proofValue.result,
      );

      if (proofId !== expected.id) {
        issues.push({
          code: "proof-id-mismatch",
          message: "content-addressed proof id does not match the replayed proof",
        });
      }
    } catch (error) {
      issues.push({
        code: "replay-failed",
        message: error instanceof Error ? error.message : "Horn proof replay failed",
      });
    }
  }

  issues.sort((left, right) =>
    left.code === right.code
      ? left.message.localeCompare(right.message)
      : left.code.localeCompare(right.code),
  );

  return {
    version: "horn-proof-verification/0.1",
    proofId,
    sourceDocumentId: document.id,
    ok: issues.length === 0,
    issues,
  };
}
