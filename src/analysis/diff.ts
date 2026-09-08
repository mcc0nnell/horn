import type { HornDocument, HornNode, HornRelation } from "../types.js";
import { stringifyNormalized } from "./canonical.js";
import {
  DIFF_CONTRACT,
  DOCUMENT_CONTRACT,
  RUNTIME_API_VERSION,
} from "./constants.js";
import { quotedNode, quotedRelation } from "./graph.js";
import { projectAnalyticalView } from "./projection.js";

function indexById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function addedRemoved(
  before: Iterable<string>,
  after: Iterable<string>,
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: [...afterSet].filter((id) => !beforeSet.has(id)).sort(),
    removed: [...beforeSet].filter((id) => !afterSet.has(id)).sort(),
  };
}

function scalarChanges(
  identity: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): Array<Record<string, unknown>> {
  const changes: Array<Record<string, unknown>> = [];
  for (const field of fields) {
    const left = before[field];
    const right = after[field];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      changes.push({ after: right ?? null, before: left ?? null, field, id: identity });
    }
  }
  return changes;
}

function nodeRecord(node: HornNode): Record<string, unknown> {
  return {
    author: node.author,
    authorShort: node.authorShort,
    citationIds: [...node.citationIds],
    focus: node.focus === true,
    geometry: node.geometry,
    kind: node.kind,
    label: node.label,
    notes: node.notes,
    number: node.number,
    origin: node.origin,
    text: node.text,
    year: node.year,
  };
}

function relationRecord(relation: HornRelation): Record<string, unknown> {
  return {
    from: relation.from,
    kind: relation.kind,
    label: relation.label,
    route: relation.route ?? null,
    to: relation.to,
  };
}

export function diffHornDocuments(
  before: HornDocument,
  after: HornDocument,
): Record<string, unknown> {
  const beforeNodes = indexById(before.nodes);
  const afterNodes = indexById(after.nodes);
  const beforeRelations = indexById(before.relations);
  const afterRelations = indexById(after.relations);
  const beforeCitations = indexById(before.citations);
  const afterCitations = indexById(after.citations);
  const beforeRegions = indexById(before.regions);
  const afterRegions = indexById(after.regions);

  const nodes = addedRemoved(
    before.nodes.map((node) => node.id),
    after.nodes.map((node) => node.id),
  );
  const relations = addedRemoved(
    before.relations.map((relation) => relation.id),
    after.relations.map((relation) => relation.id),
  );
  const citations = addedRemoved(
    before.citations.map((citation) => citation.id),
    after.citations.map((citation) => citation.id),
  );
  const regions = addedRemoved(
    before.regions.map((region) => region.id),
    after.regions.map((region) => region.id),
  );

  const content: Array<Record<string, unknown>> = [];
  const topology: Array<Record<string, unknown>> = [];
  const evidenceBindings: Array<Record<string, unknown>> = [];
  const provenance: Array<Record<string, unknown>> = [];
  const authoredGeometry: Array<Record<string, unknown>> = [];

  content.push(
    ...scalarChanges("document", before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, [
      "title",
      "subtitle",
      "issueQuestion",
      "rights",
      "unitSize",
    ]),
  );
  provenance.push(
    ...scalarChanges("document", before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, [
      "authority",
      "vocabulary",
      "after",
    ]),
  );
  authoredGeometry.push(
    ...scalarChanges("document", before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, [
      "canvas",
    ]),
  );

  const reading = addedRemoved(before.readingPath, after.readingPath);
  if (reading.added.length > 0 || reading.removed.length > 0) {
    topology.push({
      after: [...after.readingPath],
      before: [...before.readingPath],
      field: "readingPath",
      id: "document",
    });
  }

  for (const id of after.nodes.map((node) => node.id)) {
    const left = beforeNodes.get(id);
    const right = afterNodes.get(id);
    if (!left || !right) {
      continue;
    }
    const leftRec = nodeRecord(left);
    const rightRec = nodeRecord(right);
    content.push(
      ...scalarChanges(id, leftRec, rightRec, [
        "label",
        "text",
        "kind",
        "number",
        "focus",
        "author",
        "authorShort",
        "year",
        "notes",
      ]),
    );
    provenance.push(...scalarChanges(id, leftRec, rightRec, ["origin"]));
    evidenceBindings.push(
      ...scalarChanges(id, leftRec, rightRec, ["citationIds"]),
    );
    authoredGeometry.push(...scalarChanges(id, leftRec, rightRec, ["geometry"]));
  }

  for (const id of after.relations.map((relation) => relation.id)) {
    const left = beforeRelations.get(id);
    const right = afterRelations.get(id);
    if (!left || !right) {
      continue;
    }
    const leftRec = relationRecord(left);
    const rightRec = relationRecord(right);
    topology.push(...scalarChanges(id, leftRec, rightRec, ["from", "to", "kind"]));
    content.push(...scalarChanges(id, leftRec, rightRec, ["label"]));
    authoredGeometry.push(...scalarChanges(id, leftRec, rightRec, ["route"]));
  }

  for (const id of after.citations.map((citation) => citation.id)) {
    const left = beforeCitations.get(id);
    const right = afterCitations.get(id);
    if (!left || !right) {
      continue;
    }
    provenance.push(
      ...scalarChanges(
        id,
        left as unknown as Record<string, unknown>,
        right as unknown as Record<string, unknown>,
        ["layer", "citation", "short", "year", "url"],
      ),
    );
  }

  for (const id of after.regions.map((region) => region.id)) {
    const left = beforeRegions.get(id);
    const right = afterRegions.get(id);
    if (!left || !right) {
      continue;
    }
    content.push(
      ...scalarChanges(
        id,
        left as unknown as Record<string, unknown>,
        right as unknown as Record<string, unknown>,
        ["label"],
      ),
    );
    authoredGeometry.push(
      ...scalarChanges(
        id,
        left as unknown as Record<string, unknown>,
        right as unknown as Record<string, unknown>,
        ["geometry"],
      ),
    );
  }

  const projectionConsequences: Record<string, unknown> = {};
  for (const view of ["argument", "timeline", "evidence", "frontier"] as const) {
    const left = projectAnalyticalView(before, view);
    const right = projectAnalyticalView(after, view);
    projectionConsequences[view] = {
      nodes: addedRemoved(left.nodes, right.nodes),
      relations: addedRemoved(left.relations, right.relations),
    };
  }

  return {
    authoredGeometry,
    before: { documentId: before.id, documentVersion: DOCUMENT_CONTRACT },
    after: { documentId: after.id, documentVersion: DOCUMENT_CONTRACT },
    content,
    evidenceBindings,
    identities: {
      citations,
      nodes,
      regions,
      relations,
    },
    projectionConsequences,
    provenance,
    runtime: RUNTIME_API_VERSION,
    topology: {
      addedRelations: relations.added,
      removedRelations: relations.removed,
      changes: topology,
    },
    version: DIFF_CONTRACT,
  };
}

export function stringifyDiff(value: Record<string, unknown>): string {
  return stringifyNormalized(value);
}

export { quotedNode, quotedRelation };
