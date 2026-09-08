import type { HornDocument } from "../types.js";
import { stringifyNormalized } from "./canonical.js";
import {
  CHALLENGE_RELATION_KINDS,
  DOCUMENT_CONTRACT,
  QUERY_CONTRACT,
  QUERY_RESULT_CONTRACT,
  RUNTIME_API_VERSION,
  SUPPORT_RELATION_KINDS,
} from "./constants.js";
import {
  allFocusThreads,
  citationById,
  cloneDocument,
  hops,
  inboundRelations,
  nodeById,
  outboundRelations,
  quotedCitation,
  quotedNode,
  quotedRelation,
  reachable,
  relationById,
  simplePaths,
  threadForFocus,
} from "./graph.js";
import { projectAnalyticalView } from "./projection.js";

export type QueryRequest = {
  version?: string;
  op: string;
  id?: string;
  from?: string;
  to?: string;
  direction?: "inbound" | "outbound" | "both" | "semantic" | "reading";
  kinds?: string[];
  suppress?: {
    nodes?: string[];
    relations?: string[];
    evidenceBindings?: Array<string | { citationId?: string; nodeId?: string }>;
  };
};

type QueryResult = Record<string, unknown>;

function baseResult(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  return {
    documentId: document.id,
    documentVersion: DOCUMENT_CONTRACT,
    op: request.op,
    runtime: RUNTIME_API_VERSION,
    version: QUERY_RESULT_CONTRACT,
  };
}

function errorResult(
  document: HornDocument,
  request: QueryRequest,
  code: string,
  message: string,
): QueryResult {
  return {
    ...baseResult(document, request),
    error: { code, message },
    ok: false,
  };
}

function walkDirection(
  direction: QueryRequest["direction"],
): "inbound" | "outbound" | "both" {
  if (direction === "inbound" || direction === "semantic") {
    return direction === "semantic" ? "outbound" : "inbound";
  }
  if (direction === "outbound" || direction === "reading") {
    return direction === "reading" ? "inbound" : "outbound";
  }
  if (direction === "both") {
    return "both";
  }
  return "both";
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function nodeLookup(document: HornDocument, request: QueryRequest): QueryResult {
  if (!request.id) {
    return errorResult(document, request, "E_MISSING_ID", "node lookup requires id");
  }
  const node = nodeById(document).get(request.id);
  if (!node) {
    return errorResult(
      document,
      request,
      "E_NODE_NOT_FOUND",
      `unknown node ${request.id}`,
    );
  }
  return {
    ...baseResult(document, request),
    node: quotedNode(node),
    ok: true,
  };
}

function relationLookup(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  if (!request.id) {
    return errorResult(
      document,
      request,
      "E_MISSING_ID",
      "relation lookup requires id",
    );
  }
  const relation = relationById(document).get(request.id);
  if (!relation) {
    return errorResult(
      document,
      request,
      "E_RELATION_NOT_FOUND",
      `unknown relation ${request.id}`,
    );
  }
  return {
    ...baseResult(document, request),
    ok: true,
    relation: quotedRelation(relation),
  };
}

function neighborhood(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  if (!request.id) {
    return errorResult(
      document,
      request,
      "E_MISSING_ID",
      "neighborhood requires id",
    );
  }
  if (!nodeById(document).has(request.id)) {
    return errorResult(
      document,
      request,
      "E_NODE_NOT_FOUND",
      `unknown node ${request.id}`,
    );
  }
  const direction =
    request.direction === "inbound" || request.direction === "outbound"
      ? request.direction
      : "both";
  const inbound =
    direction === "outbound"
      ? []
      : inboundRelations(document, request.id).map(quotedRelation);
  const outbound =
    direction === "inbound"
      ? []
      : outboundRelations(document, request.id).map(quotedRelation);
  return {
    ...baseResult(document, request),
    inbound,
    nodeId: request.id,
    ok: true,
    outbound,
  };
}

function reachableQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  if (!request.id) {
    return errorResult(
      document,
      request,
      "E_MISSING_ID",
      "reachable requires id",
    );
  }
  if (!nodeById(document).has(request.id)) {
    return errorResult(
      document,
      request,
      "E_NODE_NOT_FOUND",
      `unknown node ${request.id}`,
    );
  }
  const walked = reachable(
    document,
    request.id,
    walkDirection(request.direction),
    request.kinds,
  );
  return {
    ...baseResult(document, request),
    nodeIds: walked.nodeIds,
    ok: true,
    relationIds: walked.relationIds,
  };
}

function ancestorsQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  return reachableQuery(document, {
    ...request,
    direction: "semantic",
    op: request.op,
  });
}

function descendantsQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  return reachableQuery(document, {
    ...request,
    direction: "reading",
    op: request.op,
  });
}

function pathQuery(
  document: HornDocument,
  request: QueryRequest,
  kinds: readonly string[],
): QueryResult {
  const start = request.id ?? request.from;
  if (!start) {
    return errorResult(
      document,
      request,
      "E_MISSING_ID",
      `${request.op} requires id or from`,
    );
  }
  if (!nodeById(document).has(start)) {
    return errorResult(
      document,
      request,
      "E_NODE_NOT_FOUND",
      `unknown node ${start}`,
    );
  }
  const inbound = hops(document, start, "inbound", kinds).map((hop) => ({
    from: hop.from,
    kind: hop.kind,
    relationId: hop.relationId,
  }));
  const outbound = hops(document, start, "outbound", kinds).map((hop) => ({
    kind: hop.kind,
    relationId: hop.relationId,
    to: hop.to,
  }));
  const closure = reachable(document, start, "both", kinds);
  const paths =
    request.to !== undefined
      ? simplePaths(document, start, request.to, "both", kinds)
      : [];
  return {
    ...baseResult(document, request),
    inbound,
    nodeId: start,
    ok: true,
    outbound,
    paths,
    reachable: {
      nodeIds: closure.nodeIds,
      relationIds: closure.relationIds,
    },
  };
}

function frontierQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  try {
    const threads = request.id
      ? [threadForFocus(document, request.id)]
      : allFocusThreads(document);
    return {
      ...baseResult(document, request),
      ok: true,
      threads: threads.map((thread) => ({
        focusNodeId: thread.focusNodeId,
        frontierNodeIds: [...thread.frontierNodeIds],
        steps: thread.steps.map((step) => ({
          depth: step.depth,
          nodeId: step.nodeId,
          ...(step.parentNodeId ? { parentNodeId: step.parentNodeId } : {}),
          ...(step.relationId ? { relationId: step.relationId } : {}),
        })),
      })),
    };
  } catch (error) {
    return errorResult(
      document,
      request,
      "E_NODE_NOT_FOUND",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function evidenceBoundQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  const citations = citationById(document);
  const bound = document.nodes
    .filter((node) => node.citationIds.length > 0)
    .map((node) => ({
      citationIds: [...node.citationIds],
      nodeId: node.id,
    }));
  const byCitation: Record<string, string[]> = {};
  for (const node of document.nodes) {
    for (const citationId of node.citationIds) {
      if (!citations.has(citationId)) {
        continue;
      }
      const list = byCitation[citationId] ?? [];
      list.push(node.id);
      byCitation[citationId] = list;
    }
  }
  const citationsOut = Object.keys(byCitation)
    .sort()
    .map((citationId) => ({
      citationId,
      nodeIds: [...(byCitation[citationId] ?? [])],
    }));
  return {
    ...baseResult(document, request),
    citations: citationsOut,
    nodes: bound,
    ok: true,
  };
}

function provenanceTraceQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  if (!request.id) {
    return errorResult(
      document,
      request,
      "E_MISSING_ID",
      "provenance-trace requires id",
    );
  }
  const node = nodeById(document).get(request.id);
  if (!node) {
    return errorResult(
      document,
      request,
      "E_NODE_NOT_FOUND",
      `unknown node ${request.id}`,
    );
  }
  const citations = citationById(document);
  return {
    ...baseResult(document, request),
    citations: node.citationIds
      .map((citationId) => citations.get(citationId))
      .filter((citation) => citation !== undefined)
      .map(quotedCitation),
    inbound: inboundRelations(document, request.id).map(quotedRelation),
    node: quotedNode(node),
    ok: true,
    outbound: outboundRelations(document, request.id).map(quotedRelation),
  };
}

function orphansQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  const referencedNodes = new Set<string>();
  for (const relation of document.relations) {
    referencedNodes.add(relation.from);
    referencedNodes.add(relation.to);
  }
  const referencedCitations = new Set<string>();
  for (const node of document.nodes) {
    for (const citationId of node.citationIds) {
      referencedCitations.add(citationId);
    }
  }
  return {
    ...baseResult(document, request),
    ok: true,
    unreferencedCitations: document.citations
      .map((citation) => citation.id)
      .filter((id) => !referencedCitations.has(id))
      .sort(),
    unreferencedNodes: document.nodes
      .map((node) => node.id)
      .filter((id) => !referencedNodes.has(id))
      .sort(),
  };
}

type BindingSuppress = { citationId?: string; nodeId?: string };

function parseBindingSuppress(
  value: string | BindingSuppress,
): BindingSuppress {
  if (typeof value === "string") {
    return { citationId: value };
  }
  return value;
}

function applyCounterfactual(
  document: HornDocument,
  request: QueryRequest,
): HornDocument {
  const suppressedNodes = new Set(request.suppress?.nodes ?? []);
  const suppressedRelations = new Set(request.suppress?.relations ?? []);
  const suppressedBindings = (request.suppress?.evidenceBindings ?? []).map(
    parseBindingSuppress,
  );

  const copy = cloneDocument(document);
  copy.nodes = copy.nodes
    .filter((node) => !suppressedNodes.has(node.id))
    .map((node) => ({
      ...node,
      citationIds: node.citationIds.filter((citationId) => {
        return !suppressedBindings.some((binding) => {
          if (binding.citationId && binding.citationId !== citationId) {
            return false;
          }
          if (binding.nodeId && binding.nodeId !== node.id) {
            return false;
          }
          return binding.citationId !== undefined || binding.nodeId !== undefined;
        });
      }),
    }));
  const remainingNodes = new Set(copy.nodes.map((node) => node.id));
  copy.relations = copy.relations.filter(
    (relation) =>
      !suppressedRelations.has(relation.id) &&
      remainingNodes.has(relation.from) &&
      remainingNodes.has(relation.to),
  );
  copy.readingPath = copy.readingPath.filter((id) => remainingNodes.has(id));
  return copy;
}

function counterfactualQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  const beforeFrontier = projectAnalyticalView(document, "frontier");
  const hypothetical = applyCounterfactual(document, request);
  const remainingNodeIds = hypothetical.nodes.map((node) => node.id);
  const remainingRelationIds = hypothetical.relations.map(
    (relation) => relation.id,
  );
  const focusSeeds = hypothetical.nodes
    .filter((node) => node.focus === true)
    .map((node) => node.id);
  const reachableFromFocus = new Set<string>();
  const reachableRelations = new Set<string>();
  for (const seed of focusSeeds.length > 0 ? focusSeeds : remainingNodeIds.slice(0, 1)) {
    const walked = reachable(hypothetical, seed, "both");
    for (const id of walked.nodeIds) {
      reachableFromFocus.add(id);
    }
    for (const id of walked.relationIds) {
      reachableRelations.add(id);
    }
  }

  const disconnected = remainingNodeIds.filter(
    (id) => !reachableFromFocus.has(id),
  );
  const afterFrontier = projectAnalyticalView(hypothetical, "frontier");
  const beforeFrontierIds =
    (beforeFrontier.extensions["x-analysis"].placed as Array<{ id: string }>) ??
    [];
  const afterFrontierIds =
    (afterFrontier.extensions["x-analysis"].placed as Array<{ id: string }>) ??
    [];
  const beforeSupport = document.relations
    .filter((relation) => relation.kind === "supports" || relation.kind === "warrants")
    .map((relation) => relation.id);
  const afterSupport = hypothetical.relations
    .filter((relation) => relation.kind === "supports" || relation.kind === "warrants")
    .map((relation) => relation.id);

  return {
    ...baseResult(document, request),
    after: {
      frontierNodeIds: afterFrontierIds.map((item) => item.id),
      nodeIds: remainingNodeIds,
      relationIds: remainingRelationIds,
      supportRelationIds: afterSupport,
    },
    before: {
      frontierNodeIds: beforeFrontierIds.map((item) => item.id),
      nodeIds: document.nodes.map((node) => node.id),
      relationIds: document.relations.map((relation) => relation.id),
      supportRelationIds: beforeSupport,
    },
    disconnectedIds: disconnected,
    ok: true,
    reachableArgument: {
      nodeIds: [...reachableFromFocus],
      relationIds: sortedUnique(reachableRelations),
    },
    sourceMutated: false,
    suppressed: {
      evidenceBindings: request.suppress?.evidenceBindings ?? [],
      nodes: [...(request.suppress?.nodes ?? [])].sort(),
      relations: [...(request.suppress?.relations ?? [])].sort(),
    },
  };
}

const OPS: Record<
  string,
  (document: HornDocument, request: QueryRequest) => QueryResult
> = {
  "node-lookup": nodeLookup,
  "relation-lookup": relationLookup,
  neighborhood,
  reachable: reachableQuery,
  ancestors: ancestorsQuery,
  descendants: descendantsQuery,
  "support-path": (document, request) =>
    pathQuery(document, request, request.kinds ?? SUPPORT_RELATION_KINDS),
  "challenge-path": (document, request) =>
    pathQuery(document, request, request.kinds ?? CHALLENGE_RELATION_KINDS),
  frontier: frontierQuery,
  "evidence-bound": evidenceBoundQuery,
  "provenance-trace": provenanceTraceQuery,
  orphans: orphansQuery,
  counterfactual: counterfactualQuery,
};

export function runQuery(
  document: HornDocument,
  request: QueryRequest,
): QueryResult {
  if (request.version && request.version !== QUERY_CONTRACT) {
    return errorResult(
      document,
      request,
      "E_QUERY_VERSION",
      `unsupported query contract ${request.version}`,
    );
  }
  const handler = OPS[request.op];
  if (!handler) {
    return errorResult(
      document,
      request,
      "E_UNKNOWN_OP",
      `unknown query op ${request.op}`,
    );
  }
  return handler(document, request);
}

export function stringifyQueryResult(result: QueryResult): string {
  return stringifyNormalized(result);
}

export { applyCounterfactual };
