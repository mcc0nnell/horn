import { deriveHornDialogueGraph } from "./analysis";
import type { HornDialogueAnalysisOptions } from "./analysis";
import type { HornDocument } from "./types";

export type HornMinimumCutResult = {
  version: "horn-minimum-cut/0.1";
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
  };
  focusNodeId: string;
  targetNodeId: string;
  finite: boolean;
  cardinality: number | null;
  cutNodeIds: string[];
};

type ResidualEdge = {
  to: string;
  reverseIndex: number;
  capacity: number;
};

function addResidualEdge(
  graph: Map<string, ResidualEdge[]>,
  from: string,
  to: string,
  capacity: number,
): void {
  const forward = graph.get(from) ?? [];
  const reverse = graph.get(to) ?? [];
  const forwardIndex = forward.length;
  const reverseIndex = reverse.length;

  forward.push({ to, reverseIndex, capacity });
  reverse.push({ to: from, reverseIndex: forwardIndex, capacity: 0 });
  graph.set(from, forward);
  graph.set(to, reverse);
}

function augmentingPath(
  graph: Map<string, ResidualEdge[]>,
  source: string,
  sink: string,
): Map<string, { from: string; edgeIndex: number }> | undefined {
  const parent = new Map<string, { from: string; edgeIndex: number }>();
  const visited = new Set<string>([source]);
  const queue = [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const edges = graph.get(current) ?? [];
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
      const edge = edges[edgeIndex]!;
      if (edge.capacity <= 0 || visited.has(edge.to)) continue;
      visited.add(edge.to);
      parent.set(edge.to, { from: current, edgeIndex });
      if (edge.to === sink) return parent;
      queue.push(edge.to);
    }
  }

  return undefined;
}

function residualReachable(
  graph: Map<string, ResidualEdge[]>,
  source: string,
): Set<string> {
  const reachable = new Set<string>([source]);
  const queue = [source];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of graph.get(current) ?? []) {
      if (edge.capacity <= 0 || reachable.has(edge.to)) continue;
      reachable.add(edge.to);
      queue.push(edge.to);
    }
  }
  return reachable;
}

/**
 * Find one deterministic minimum internal vertex cut in the reader-facing
 * dialogue graph using unit-capacity node splitting and max flow.
 *
 * The focus and target are never eligible cut vertices. `finite: false` means
 * no finite set of internal dialogue nodes can disconnect the target (for
 * example, a direct focus -> target dialogue edge exists).
 */
export function analyzeHornMinimumCut(
  document: HornDocument,
  focusNodeId: string,
  targetNodeId: string,
  options: Pick<HornDialogueAnalysisOptions, "relationKinds"> = {},
): HornMinimumCutResult {
  const dialogue = deriveHornDialogueGraph(document, focusNodeId, options);
  if (!dialogue.nodeIds.includes(targetNodeId)) {
    throw new Error(`Horn target node is not reachable from focus: ${targetNodeId}`);
  }

  if (focusNodeId === targetNodeId) {
    return {
      version: "horn-minimum-cut/0.1",
      source: { documentId: document.id, documentVersion: document.version },
      focusNodeId,
      targetNodeId,
      finite: true,
      cardinality: 0,
      cutNodeIds: [],
    };
  }

  const network = new Map<string, ResidualEdge[]>();
  const infinity = dialogue.nodeIds.length + 1;
  const nodeIn = (nodeId: string) => `in:${nodeId}`;
  const nodeOut = (nodeId: string) => `out:${nodeId}`;

  for (const nodeId of dialogue.nodeIds) {
    addResidualEdge(
      network,
      nodeIn(nodeId),
      nodeOut(nodeId),
      nodeId === focusNodeId || nodeId === targetNodeId ? infinity : 1,
    );
  }

  for (const edge of dialogue.edges) {
    addResidualEdge(
      network,
      nodeOut(edge.earlierNodeId),
      nodeIn(edge.responseNodeId),
      infinity,
    );
  }

  const source = nodeOut(focusNodeId);
  const sink = nodeIn(targetNodeId);
  let flow = 0;

  while (flow < infinity) {
    const parent = augmentingPath(network, source, sink);
    if (!parent) break;

    let bottleneck = infinity;
    let cursor = sink;
    while (cursor !== source) {
      const step = parent.get(cursor);
      if (!step) throw new Error("internal Horn min-cut path reconstruction failure");
      const edge = network.get(step.from)?.[step.edgeIndex];
      if (!edge) throw new Error("internal Horn min-cut residual edge failure");
      bottleneck = Math.min(bottleneck, edge.capacity);
      cursor = step.from;
    }

    cursor = sink;
    while (cursor !== source) {
      const step = parent.get(cursor)!;
      const edge = network.get(step.from)![step.edgeIndex]!;
      const reverse = network.get(edge.to)![edge.reverseIndex]!;
      edge.capacity -= bottleneck;
      reverse.capacity += bottleneck;
      cursor = step.from;
    }
    flow += bottleneck;
  }

  if (flow >= infinity) {
    return {
      version: "horn-minimum-cut/0.1",
      source: { documentId: document.id, documentVersion: document.version },
      focusNodeId,
      targetNodeId,
      finite: false,
      cardinality: null,
      cutNodeIds: [],
    };
  }

  const reachable = residualReachable(network, source);
  const cutNodeIds = dialogue.nodeIds.filter(
    (nodeId) =>
      nodeId !== focusNodeId &&
      nodeId !== targetNodeId &&
      reachable.has(nodeIn(nodeId)) &&
      !reachable.has(nodeOut(nodeId)),
  );

  return {
    version: "horn-minimum-cut/0.1",
    source: { documentId: document.id, documentVersion: document.version },
    focusNodeId,
    targetNodeId,
    finite: true,
    cardinality: flow,
    cutNodeIds,
  };
}
