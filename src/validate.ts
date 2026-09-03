import type { HornDocument } from "./types";

export type HornIssue = {
  code: string;
  message: string;
};

export function validateHornDocument(doc: HornDocument): HornIssue[] {
  const issues: HornIssue[] = [];
  const nodeIds = new Set<string>();
  const citationById = new Map(doc.citations.map((c) => [c.id, c]));

  if (doc.version !== "horn-document/0.1") {
    issues.push({
      code: "version",
      message: `Unsupported version ${doc.version}`,
    });
  }

  for (const node of doc.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "duplicate-id",
        message: `Duplicate node id ${node.id}`,
      });
    }
    nodeIds.add(node.id);

    if (node.origin === "authored" && doc.authority === "historical") {
      issues.push({
        code: "authored-in-historical",
        message: `Authored node ${node.id} cannot live in a historical document`,
      });
    }

    if (node.origin === "debate") {
      const hasMapped = node.citationIds.some(
        (id) => citationById.get(id)?.layer === "mapped",
      );
      if (!hasMapped) {
        issues.push({
          code: "missing-layer-a",
          message: `Debate node ${node.id} has no mapped (Layer A) citation`,
        });
      }
    }
  }

  for (const node of doc.nodes) {
    for (const cid of node.citationIds) {
      if (!citationById.has(cid)) {
        issues.push({
          code: "missing-citation",
          message: `Node ${node.id} references unknown citation ${cid}`,
        });
      }
    }
  }

  for (const rel of doc.relations) {
    if (!nodeIds.has(rel.from) || !nodeIds.has(rel.to)) {
      issues.push({
        code: "dangling-relation",
        message: `Relation ${rel.id} has unresolved endpoints`,
      });
    }
  }

  const numbers = doc.nodes.map((n) => n.number);
  if (new Set(numbers).size !== numbers.length) {
    issues.push({
      code: "duplicate-number",
      message: "Claim numbers must be unique",
    });
  }

  for (const id of doc.readingPath) {
    if (!nodeIds.has(id)) {
      issues.push({
        code: "dangling-path",
        message: `Reading path references unknown node ${id}`,
      });
    }
  }

  const authored = doc.nodes.filter((n) => n.origin === "authored");
  if (authored.length < 1) {
    issues.push({
      code: "authored-mark",
      message: "Slice must include at least one authored gloss, visually distinct",
    });
  }

  return issues;
}

export function assertValid(doc: HornDocument): HornDocument {
  const issues = validateHornDocument(doc);
  if (issues.length > 0) {
    throw new Error(
      `Horn document failed validation:\n${issues.map((i) => `${i.code}: ${i.message}`).join("\n")}`,
    );
  }
  return doc;
}
