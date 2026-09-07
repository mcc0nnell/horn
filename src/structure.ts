import type { HornDocument, RelationKind } from "./types";

export const hornDialecticalRelationKinds = [
  "supports",
  "disputes",
  "interprets-as",
] as const satisfies readonly RelationKind[];

export type HornThreadStep = {
  nodeId: string;
  depth: number;
  parentNodeId?: string;
  relationId?: string;
};

export type HornThreadStructure = {
  focusNodeId: string;
  steps: HornThreadStep[];
  frontierNodeIds: string[];
};

export type DeriveHornThreadOptions = {
  relationKinds?: readonly RelationKind[];
};

/**
 * Derive the reader-facing dialogue that grows outward from a focus box.
 *
 * Horn's map arrows encode reading order from an earlier claim to a later
 * response. HornDocument relations encode the semantic response direction:
 * the responding claim (`from`) supports/disputes/interprets the earlier
 * claim (`to`). Deriving a readable thread therefore walks relations in
 * reverse semantic direction: `to -> from`.
 *
 * This helper derives analytical structure only. It never rewrites relation
 * endpoints or persisted route geometry.
 */
export function deriveHornThread(
  document: HornDocument,
  focusNodeId: string,
  options: DeriveHornThreadOptions = {},
): HornThreadStructure {
  const nodeIds = new Set(document.nodes.map((node) => node.id));
  if (!nodeIds.has(focusNodeId)) {
    throw new Error(`unknown Horn focus node: ${focusNodeId}`);
  }

  const relationKinds = new Set(
    options.relationKinds ?? hornDialecticalRelationKinds,
  );
  const responsesByTarget = new Map<
    string,
    Array<{ nodeId: string; relationId: string }>
  >();

  for (const relation of document.relations) {
    if (!relationKinds.has(relation.kind)) {
      continue;
    }

    const responses = responsesByTarget.get(relation.to) ?? [];
    responses.push({ nodeId: relation.from, relationId: relation.id });
    responsesByTarget.set(relation.to, responses);
  }

  for (const responses of responsesByTarget.values()) {
    responses.sort((left, right) => {
      const leftNode = document.nodes.find((node) => node.id === left.nodeId);
      const rightNode = document.nodes.find((node) => node.id === right.nodeId);
      return (leftNode?.number ?? 0) - (rightNode?.number ?? 0);
    });
  }

  const steps: HornThreadStep[] = [
    { nodeId: focusNodeId, depth: 0 },
  ];
  const visited = new Set([focusNodeId]);
  const queue = [{ nodeId: focusNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const response of responsesByTarget.get(current.nodeId) ?? []) {
      if (visited.has(response.nodeId)) {
        continue;
      }

      visited.add(response.nodeId);
      const step: HornThreadStep = {
        nodeId: response.nodeId,
        depth: current.depth + 1,
        parentNodeId: current.nodeId,
        relationId: response.relationId,
      };
      steps.push(step);
      queue.push({ nodeId: response.nodeId, depth: step.depth });
    }
  }

  const frontierNodeIds = steps
    .filter((step) =>
      (responsesByTarget.get(step.nodeId) ?? []).every(
        (response) => !visited.has(response.nodeId),
      ),
    )
    .map((step) => step.nodeId)
    .filter((nodeId) => nodeId !== focusNodeId || steps.length === 1);

  return { focusNodeId, steps, frontierNodeIds };
}
