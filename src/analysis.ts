import { hornDialecticalRelationKinds } from "./structure";
import type { HornDocument, RelationKind } from "./types";

export type HornDialogueEdge = {
  relationId: string;
  kind: RelationKind;
  earlierNodeId: string;
  responseNodeId: string;
};

export type HornDialogueGraph = {
  focusNodeId: string;
  nodeIds: string[];
  edges: HornDialogueEdge[];
};

export type HornDialogueAnalysisOptions = {
  relationKinds?: readonly RelationKind[];
  suppressedNodeIds?: readonly string[];
  suppressedRelationIds?: readonly string[];
};

export type HornCounterfactualResult = {
  version: "horn-counterfactual/0.1";
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
  };
  focusNodeId: string;
  suppressedNodeIds: string[];
  suppressedRelationIds: string[];
  baseline: {
    reachableNodeIds: string[];
    frontierNodeIds: string[];
  };
  result: {
    reachableNodeIds: string[];
    frontierNodeIds: string[];
  };
  disconnectedNodeIds: string[];
  frontierDelta: {
    addedNodeIds: string[];
    removedNodeIds: string[];
  };
};

export type HornDominatorResult = {
  version: "horn-dominators/0.1";
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
  };
  focusNodeId: string;
  targetNodeId: string;
  dominatorNodeIds: string[];
  strictDominatorNodeIds: string[];
};

function stableNodeOrder(document: HornDocument): Map<string, number> {
  return new Map(
    [...document.nodes]
      .sort((left, right) => left.number - right.number || left.id.localeCompare(right.id))
      .map((node, index) => [node.id, index]),
  );
}

function sortNodeIds(ids: Iterable<string>, order: Map<string, number>): string[] {
  return [...ids].sort((left, right) =>
    (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right),
  );
}

function assertKnownNode(document: HornDocument, nodeId: string, subject: string): void {
  if (!document.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`unknown Horn ${subject} node: ${nodeId}`);
  }
}

/**
 * Build the reader-facing dialogue graph for deterministic analysis.
 *
 * HornDocument relation direction is semantic response -> earlier claim.
 * Analytical dialogue traversal is therefore earlier claim -> response.
 * The graph is derived only; it never rewrites relation endpoints or routes.
 */
export function deriveHornDialogueGraph(
  document: HornDocument,
  focusNodeId: string,
  options: HornDialogueAnalysisOptions = {},
): HornDialogueGraph {
  assertKnownNode(document, focusNodeId, "focus");

  const allowedKinds = new Set(options.relationKinds ?? hornDialecticalRelationKinds);
  const suppressedNodes = new Set(options.suppressedNodeIds ?? []);
  const suppressedRelations = new Set(options.suppressedRelationIds ?? []);
  const order = stableNodeOrder(document);

  if (suppressedNodes.has(focusNodeId)) {
    return { focusNodeId, nodeIds: [], edges: [] };
  }

  const edges = document.relations
    .filter((relation) => allowedKinds.has(relation.kind))
    .filter((relation) => !suppressedRelations.has(relation.id))
    .filter(
      (relation) =>
        !suppressedNodes.has(relation.from) && !suppressedNodes.has(relation.to),
    )
    .map<HornDialogueEdge>((relation) => ({
      relationId: relation.id,
      kind: relation.kind,
      earlierNodeId: relation.to,
      responseNodeId: relation.from,
    }))
    .sort((left, right) =>
      (order.get(left.earlierNodeId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.earlierNodeId) ?? Number.MAX_SAFE_INTEGER) ||
      (order.get(left.responseNodeId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.responseNodeId) ?? Number.MAX_SAFE_INTEGER) ||
      left.relationId.localeCompare(right.relationId),
    );

  const responsesByEarlier = new Map<string, HornDialogueEdge[]>();
  for (const edge of edges) {
    const responses = responsesByEarlier.get(edge.earlierNodeId) ?? [];
    responses.push(edge);
    responsesByEarlier.set(edge.earlierNodeId, responses);
  }

  const reachable = new Set<string>([focusNodeId]);
  const queue = [focusNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const edge of responsesByEarlier.get(current) ?? []) {
      if (reachable.has(edge.responseNodeId)) continue;
      reachable.add(edge.responseNodeId);
      queue.push(edge.responseNodeId);
    }
  }

  return {
    focusNodeId,
    nodeIds: sortNodeIds(reachable, order),
    edges: edges.filter(
      (edge) => reachable.has(edge.earlierNodeId) && reachable.has(edge.responseNodeId),
    ),
  };
}

export function deriveHornDialogueFrontier(graph: HornDialogueGraph): string[] {
  const outgoing = new Set(graph.edges.map((edge) => edge.earlierNodeId));
  return graph.nodeIds.filter((nodeId) => !outgoing.has(nodeId));
}

export function analyzeHornCounterfactual(
  document: HornDocument,
  focusNodeId: string,
  options: HornDialogueAnalysisOptions = {},
): HornCounterfactualResult {
  const order = stableNodeOrder(document);
  const baseline = deriveHornDialogueGraph(document, focusNodeId, {
    relationKinds: options.relationKinds,
  });
  const result = deriveHornDialogueGraph(document, focusNodeId, options);

  const baselineNodes = new Set(baseline.nodeIds);
  const resultNodes = new Set(result.nodeIds);
  const baselineFrontier = deriveHornDialogueFrontier(baseline);
  const resultFrontier = deriveHornDialogueFrontier(result);
  const baselineFrontierSet = new Set(baselineFrontier);
  const resultFrontierSet = new Set(resultFrontier);

  return {
    version: "horn-counterfactual/0.1",
    source: {
      documentId: document.id,
      documentVersion: document.version,
    },
    focusNodeId,
    suppressedNodeIds: sortNodeIds(options.suppressedNodeIds ?? [], order),
    suppressedRelationIds: [...(options.suppressedRelationIds ?? [])].sort(),
    baseline: {
      reachableNodeIds: baseline.nodeIds,
      frontierNodeIds: baselineFrontier,
    },
    result: {
      reachableNodeIds: result.nodeIds,
      frontierNodeIds: resultFrontier,
    },
    disconnectedNodeIds: sortNodeIds(
      baseline.nodeIds.filter((nodeId) => !resultNodes.has(nodeId)),
      order,
    ),
    frontierDelta: {
      addedNodeIds: sortNodeIds(
        resultFrontier.filter((nodeId) => !baselineFrontierSet.has(nodeId)),
        order,
      ),
      removedNodeIds: sortNodeIds(
        baselineFrontier.filter((nodeId) => !resultFrontierSet.has(nodeId)),
        order,
      ),
    },
  };
}

function intersectSets(left: Set<string>, right: Set<string>): Set<string> {
  return new Set([...left].filter((value) => right.has(value)));
}

/**
 * Return graph-theoretic dominators in the reader-facing dialogue graph.
 * A node dominates target when every dialogue path from focus to target passes
 * through that node. This is a derived structural fact, not a truth judgment.
 */
export function analyzeHornDominators(
  document: HornDocument,
  focusNodeId: string,
  targetNodeId: string,
  options: Pick<HornDialogueAnalysisOptions, "relationKinds"> = {},
): HornDominatorResult {
  assertKnownNode(document, targetNodeId, "target");

  const graph = deriveHornDialogueGraph(document, focusNodeId, options);
  if (!graph.nodeIds.includes(targetNodeId)) {
    throw new Error(`Horn target node is not reachable from focus: ${targetNodeId}`);
  }

  const order = stableNodeOrder(document);
  const allReachable = new Set(graph.nodeIds);
  const predecessors = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = predecessors.get(edge.responseNodeId) ?? [];
    list.push(edge.earlierNodeId);
    predecessors.set(edge.responseNodeId, list);
  }

  const dominators = new Map<string, Set<string>>();
  for (const nodeId of graph.nodeIds) {
    dominators.set(
      nodeId,
      nodeId === focusNodeId ? new Set([focusNodeId]) : new Set(allReachable),
    );
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const nodeId of graph.nodeIds) {
      if (nodeId === focusNodeId) continue;
      const preds = predecessors.get(nodeId) ?? [];
      if (preds.length === 0) continue;

      let next = new Set(dominators.get(preds[0]!) ?? []);
      for (const predecessor of preds.slice(1)) {
        next = intersectSets(next, dominators.get(predecessor) ?? new Set());
      }
      next.add(nodeId);

      const current = dominators.get(nodeId) ?? new Set<string>();
      if (
        current.size !== next.size ||
        [...current].some((value) => !next.has(value))
      ) {
        dominators.set(nodeId, next);
        changed = true;
      }
    }
  }

  const targetDominators = sortNodeIds(dominators.get(targetNodeId) ?? [], order);
  return {
    version: "horn-dominators/0.1",
    source: {
      documentId: document.id,
      documentVersion: document.version,
    },
    focusNodeId,
    targetNodeId,
    dominatorNodeIds: targetDominators,
    strictDominatorNodeIds: targetDominators.filter(
      (nodeId) => nodeId !== focusNodeId && nodeId !== targetNodeId,
    ),
  };
}
