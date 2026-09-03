import type { HornDocument, HornNode, HornRelation } from "./types.js";

export type HornProjectionManifest = {
  id: string;
  version: "horn-projection/0.1";
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
  };
  target: string;
  nodes: string[];
  relations: string[];
  extensions?: Record<`x-${string}`, unknown>;
};

export type ResolvedHornProjection = {
  manifest: HornProjectionManifest;
  source: HornDocument;
  nodes: HornNode[];
  relations: HornRelation[];
};

export class HornProjectionError extends Error {
  readonly codes: string[];

  constructor(codes: string[]) {
    super(`Horn projection rejected: ${codes.join(", ")}`);
    this.name = "HornProjectionError";
    this.codes = codes;
  }
}

/**
 * Resolve a projection manifest against one validated Horn document.
 *
 * This function selects source identities only. It does not assign target
 * semantics, rewrite Horn objects, or mutate the source document.
 */
export function resolveHornProjection(
  document: HornDocument,
  manifest: HornProjectionManifest,
): ResolvedHornProjection {
  const errors: string[] = [];

  if (manifest.source.documentId !== document.id) {
    errors.push("E_SOURCE_DOCUMENT_ID");
  }
  if (manifest.source.documentVersion !== document.version) {
    errors.push("E_SOURCE_DOCUMENT_VERSION");
  }

  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  const relationsById = new Map(
    document.relations.map((relation) => [relation.id, relation]),
  );
  const selectedNodeIds = new Set(manifest.nodes);

  const nodes: HornNode[] = [];
  for (const nodeId of manifest.nodes) {
    const node = nodesById.get(nodeId);
    if (node === undefined) {
      errors.push(`E_NODE_NOT_FOUND:${nodeId}`);
    } else {
      nodes.push(node);
    }
  }

  const relations: HornRelation[] = [];
  for (const relationId of manifest.relations) {
    const relation = relationsById.get(relationId);
    if (relation === undefined) {
      errors.push(`E_RELATION_NOT_FOUND:${relationId}`);
      continue;
    }

    if (
      !selectedNodeIds.has(relation.from) ||
      !selectedNodeIds.has(relation.to)
    ) {
      errors.push(`E_RELATION_OUTSIDE_NODE_SET:${relationId}`);
      continue;
    }

    relations.push(relation);
  }

  if (errors.length > 0) {
    throw new HornProjectionError(errors);
  }

  return {
    manifest,
    source: document,
    nodes,
    relations,
  };
}
