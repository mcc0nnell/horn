import type { Citation, HornDocument, HornNode, HornRelation } from "./types";

export type HornTrace = {
  node: HornNode;
  incoming: Array<{
    relation: HornRelation;
    from: HornNode;
  }>;
  outgoing: Array<{
    relation: HornRelation;
    to: HornNode;
  }>;
  citations: Citation[];
};

export function traceHornNode(doc: HornDocument, nodeId: string): HornTrace {
  const nodeById = new Map(doc.nodes.map((node) => [node.id, node]));
  const citationById = new Map(
    doc.citations.map((citation) => [citation.id, citation]),
  );

  const node = nodeById.get(nodeId);
  if (!node) {
    throw new Error(`Unknown Horn node ${nodeId}`);
  }

  const incoming = doc.relations
    .filter((relation) => relation.to === nodeId)
    .map((relation) => {
      const from = nodeById.get(relation.from);
      if (!from) {
        throw new Error(`Relation ${relation.id} has unknown source ${relation.from}`);
      }
      return { relation, from };
    });

  const outgoing = doc.relations
    .filter((relation) => relation.from === nodeId)
    .map((relation) => {
      const to = nodeById.get(relation.to);
      if (!to) {
        throw new Error(`Relation ${relation.id} has unknown target ${relation.to}`);
      }
      return { relation, to };
    });

  const citations = node.citationIds.map((citationId) => {
    const citation = citationById.get(citationId);
    if (!citation) {
      throw new Error(`Node ${nodeId} has unknown citation ${citationId}`);
    }
    return citation;
  });

  return { node, incoming, outgoing, citations };
}
