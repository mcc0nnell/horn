import { deriveHornThread, type HornThreadStructure } from "../structure.js";
import type {
  Citation,
  HornDocument,
  HornNode,
  HornRelation,
  RelationKind,
} from "../types.js";
import { DIALECTICAL_RELATION_KINDS } from "./constants.js";

export type DirectedHop = {
  relationId: string;
  kind: string;
  from: string;
  to: string;
  neighborId: string;
};

export function nodeById(document: HornDocument): Map<string, HornNode> {
  return new Map(document.nodes.map((node) => [node.id, node]));
}

export function relationById(
  document: HornDocument,
): Map<string, HornRelation> {
  return new Map(document.relations.map((relation) => [relation.id, relation]));
}

export function citationById(document: HornDocument): Map<string, Citation> {
  return new Map(
    document.citations.map((citation) => [citation.id, citation]),
  );
}

export function nodeCenter(node: HornNode): { x: number; y: number } {
  return {
    x: node.geometry.x + node.geometry.w / 2,
    y: node.geometry.y + node.geometry.h / 2,
  };
}

export function inboundRelations(
  document: HornDocument,
  nodeId: string,
): HornRelation[] {
  return document.relations.filter((relation) => relation.to === nodeId);
}

export function outboundRelations(
  document: HornDocument,
  nodeId: string,
): HornRelation[] {
  return document.relations.filter((relation) => relation.from === nodeId);
}

export function hops(
  document: HornDocument,
  nodeId: string,
  direction: "inbound" | "outbound" | "both",
  kinds?: readonly string[],
): DirectedHop[] {
  const kindSet = kinds === undefined ? undefined : new Set(kinds);
  const out: DirectedHop[] = [];
  for (const relation of document.relations) {
    if (kindSet && !kindSet.has(relation.kind)) {
      continue;
    }
    if (
      (direction === "outbound" || direction === "both") &&
      relation.from === nodeId
    ) {
      out.push({
        relationId: relation.id,
        kind: relation.kind,
        from: relation.from,
        to: relation.to,
        neighborId: relation.to,
      });
    }
    if (
      (direction === "inbound" || direction === "both") &&
      relation.to === nodeId
    ) {
      out.push({
        relationId: relation.id,
        kind: relation.kind,
        from: relation.from,
        to: relation.to,
        neighborId: relation.from,
      });
    }
  }
  return out;
}

/**
 * Breadth-first walk. Neighbor expansion follows document relation order,
 * which is already deterministic. Cycles are skipped via the visited set.
 */
export function reachable(
  document: HornDocument,
  startId: string,
  direction: "inbound" | "outbound" | "both",
  kinds?: readonly string[],
): { nodeIds: string[]; relationIds: string[] } {
  const knownNodes = new Set(document.nodes.map((node) => node.id));
  if (!knownNodes.has(startId)) {
    return { nodeIds: [], relationIds: [] };
  }
  const seenNodes = new Set<string>([startId]);
  const seenRelations = new Set<string>();
  const nodeIds = [startId];
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    for (const hop of hops(document, current, direction, kinds)) {
      seenRelations.add(hop.relationId);
      if (seenNodes.has(hop.neighborId) || !knownNodes.has(hop.neighborId)) {
        continue;
      }
      seenNodes.add(hop.neighborId);
      nodeIds.push(hop.neighborId);
      queue.push(hop.neighborId);
    }
  }

  return { nodeIds, relationIds: [...seenRelations] };
}

export function simplePaths(
  document: HornDocument,
  startId: string,
  endId: string | undefined,
  direction: "inbound" | "outbound" | "both",
  kinds: readonly string[],
): Array<{ nodeIds: string[]; relationIds: string[] }> {
  const knownNodes = new Set(document.nodes.map((node) => node.id));
  if (!knownNodes.has(startId)) {
    return [];
  }
  const paths: Array<{ nodeIds: string[]; relationIds: string[] }> = [];

  const visit = (
    current: string,
    nodePath: string[],
    relationPath: string[],
    blocked: Set<string>,
  ): void => {
    if (endId !== undefined) {
      if (current === endId) {
        paths.push({ nodeIds: [...nodePath], relationIds: [...relationPath] });
        return;
      }
    } else if (nodePath.length > 1) {
      paths.push({ nodeIds: [...nodePath], relationIds: [...relationPath] });
    }

    for (const hop of hops(document, current, direction, kinds)) {
      if (blocked.has(hop.neighborId) || !knownNodes.has(hop.neighborId)) {
        continue;
      }
      blocked.add(hop.neighborId);
      visit(
        hop.neighborId,
        [...nodePath, hop.neighborId],
        [...relationPath, hop.relationId],
        blocked,
      );
      blocked.delete(hop.neighborId);
    }
  };

  visit(startId, [startId], [], new Set([startId]));

  if (endId === undefined) {
    return paths.filter((path) => path.nodeIds.length > 1);
  }
  return paths;
}

export function focusNodeIds(document: HornDocument): string[] {
  return document.nodes
    .filter((node) => node.focus === true)
    .map((node) => node.id);
}

export function threadForFocus(
  document: HornDocument,
  focusId: string,
  relationKinds?: readonly RelationKind[],
): HornThreadStructure {
  return deriveHornThread(document, focusId, {
    relationKinds: relationKinds ?? DIALECTICAL_RELATION_KINDS,
  });
}

export function allFocusThreads(
  document: HornDocument,
): HornThreadStructure[] {
  return focusNodeIds(document).map((focusId) => threadForFocus(document, focusId));
}

export function quotedNode(node: HornNode): Record<string, unknown> {
  const quoted: Record<string, unknown> = {
    citationIds: [...node.citationIds],
    id: node.id,
    kind: node.kind,
    label: node.label,
    number: node.number,
    origin: node.origin,
    text: node.text,
  };
  if (node.focus === true) {
    quoted.focus = true;
  }
  if (node.author !== undefined) {
    quoted.author = node.author;
  }
  if (node.authorShort !== undefined) {
    quoted.authorShort = node.authorShort;
  }
  if (node.year !== undefined) {
    quoted.year = node.year;
  }
  if (node.notes !== undefined) {
    quoted.notes = node.notes;
  }
  return quoted;
}

export function quotedRelation(
  relation: HornRelation,
): Record<string, unknown> {
  return {
    from: relation.from,
    id: relation.id,
    kind: relation.kind,
    label: relation.label,
    to: relation.to,
  };
}

export function quotedCitation(citation: Citation): Record<string, unknown> {
  const quoted: Record<string, unknown> = {
    citation: citation.citation,
    id: citation.id,
    layer: citation.layer,
    short: citation.short,
    year: citation.year,
  };
  if (citation.url !== undefined) {
    quoted.url = citation.url;
  }
  return quoted;
}

export function cloneDocument(document: HornDocument): HornDocument {
  return structuredClone(document);
}
