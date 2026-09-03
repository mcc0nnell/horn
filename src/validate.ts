import type {
  HornDocument,
  HornPathCommand,
  HornRoute,
  Rect,
} from "./types";

export type HornIssue = {
  code: string;
  message: string;
};

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function pointInsideCanvas(
  x: number,
  y: number,
  canvas: HornDocument["canvas"],
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x <= canvas.width &&
    y <= canvas.height
  );
}

function validateRect(
  issues: HornIssue[],
  rect: Rect,
  canvas: HornDocument["canvas"],
  subject: string,
): void {
  if (
    !finiteNonNegative(rect.x) ||
    !finiteNonNegative(rect.y) ||
    !finitePositive(rect.w) ||
    !finitePositive(rect.h)
  ) {
    issues.push({
      code: "invalid-geometry",
      message: `${subject} has invalid geometry`,
    });
    return;
  }

  if (rect.x + rect.w > canvas.width || rect.y + rect.h > canvas.height) {
    issues.push({
      code: "geometry-outside-canvas",
      message: `${subject} extends outside the canvas`,
    });
  }
}

function controlPointsAreFinite(command: HornPathCommand): boolean {
  switch (command.op) {
    case "Q":
      return Number.isFinite(command.x1) && Number.isFinite(command.y1);
    case "C":
      return (
        Number.isFinite(command.x1) &&
        Number.isFinite(command.y1) &&
        Number.isFinite(command.x2) &&
        Number.isFinite(command.y2)
      );
    default:
      return true;
  }
}

function commandEndpoint(
  command: HornPathCommand,
): { x: number; y: number } | undefined {
  switch (command.op) {
    case "M":
    case "L":
    case "Q":
    case "C":
      return { x: command.x, y: command.y };
    case "Z":
      return undefined;
  }
}

function validateRoute(
  issues: HornIssue[],
  route: HornRoute,
  canvas: HornDocument["canvas"],
  relationId: string,
): void {
  if (route.commands.length < 2) {
    issues.push({
      code: "route-too-short",
      message: `Relation ${relationId} route needs a move plus at least one drawing command`,
    });
    return;
  }

  if (route.commands[0]?.op !== "M") {
    issues.push({
      code: "route-missing-move",
      message: `Relation ${relationId} route must begin with M`,
    });
  }

  if (!route.commands.some((command) => ["L", "Q", "C"].includes(command.op))) {
    issues.push({
      code: "route-not-drawable",
      message: `Relation ${relationId} route has no drawable segment`,
    });
  }

  route.commands.forEach((command, index) => {
    if (!controlPointsAreFinite(command)) {
      issues.push({
        code: "invalid-route-control-point",
        message: `Relation ${relationId} route command ${index} has a non-finite control point`,
      });
    }

    const endpoint = commandEndpoint(command);
    if (
      endpoint &&
      !pointInsideCanvas(endpoint.x, endpoint.y, canvas)
    ) {
      issues.push({
        code: "route-outside-canvas",
        message: `Relation ${relationId} route command ${index} ends outside the canvas`,
      });
    }
  });

  if (route.labelGeometry) {
    validateRect(
      issues,
      route.labelGeometry,
      canvas,
      `Relation ${relationId} label`,
    );
  }
}

export function validateHornDocument(doc: HornDocument): HornIssue[] {
  const issues: HornIssue[] = [];

  if (doc.version !== "horn-document/0.1") {
    issues.push({
      code: "version",
      message: `Unsupported version ${doc.version}`,
    });
  }

  if (!finitePositive(doc.canvas.width) || !finitePositive(doc.canvas.height)) {
    issues.push({
      code: "invalid-canvas",
      message: "Canvas width and height must be finite positive numbers",
    });
  }

  if (doc.authority === "authored") {
    if (!doc.after || doc.after.name.trim() === "" || doc.after.works.length < 1) {
      issues.push({
        code: "missing-after",
        message: "Authored documents must identify who/what they are after",
      });
    }
  } else if (doc.after) {
    issues.push({
      code: "after-in-historical",
      message: "Historical documents must not carry authored 'after' metadata",
    });
  }

  const citationById = new Map<string, HornDocument["citations"][number]>();
  for (const citation of doc.citations) {
    if (citationById.has(citation.id)) {
      issues.push({
        code: "duplicate-citation-id",
        message: `Duplicate citation id ${citation.id}`,
      });
    }
    citationById.set(citation.id, citation);
  }

  if (!doc.citations.some((citation) => citation.layer === "cartographic")) {
    issues.push({
      code: "missing-layer-b",
      message: "Document has no cartographic (Layer B) provenance",
    });
  }

  const nodeIds = new Set<string>();
  const nodeNumbers = new Set<number>();
  let authoredNodeCount = 0;

  for (const node of doc.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "duplicate-node-id",
        message: `Duplicate node id ${node.id}`,
      });
    }
    nodeIds.add(node.id);

    if (!Number.isInteger(node.number) || node.number < 1) {
      issues.push({
        code: "invalid-number",
        message: `Node ${node.id} must have a positive integer number`,
      });
    }
    if (nodeNumbers.has(node.number)) {
      issues.push({
        code: "duplicate-number",
        message: `Duplicate node number ${node.number}`,
      });
    }
    nodeNumbers.add(node.number);

    if (node.origin === "authored") {
      authoredNodeCount += 1;
      if (doc.authority === "historical") {
        issues.push({
          code: "authored-in-historical",
          message: `Authored node ${node.id} cannot live in a historical document`,
        });
      }
    }

    validateRect(issues, node.geometry, doc.canvas, `Node ${node.id}`);

    for (const cid of node.citationIds) {
      if (!citationById.has(cid)) {
        issues.push({
          code: "missing-citation",
          message: `Node ${node.id} references unknown citation ${cid}`,
        });
      }
    }

    const layers = new Set(
      node.citationIds
        .map((id) => citationById.get(id)?.layer)
        .filter((layer): layer is "mapped" | "cartographic" => layer !== undefined),
    );

    if (node.origin === "debate" && !layers.has("mapped")) {
      issues.push({
        code: "missing-layer-a",
        message: `Debate node ${node.id} has no mapped (Layer A) citation`,
      });
    }

    if (node.origin === "authored" && !layers.has("cartographic")) {
      issues.push({
        code: "missing-cartographic-provenance",
        message: `Authored node ${node.id} has no cartographic citation`,
      });
    }
  }

  if (doc.authority === "authored" && authoredNodeCount < 1) {
    issues.push({
      code: "missing-authored-node",
      message: "Authored documents must contain at least one explicitly authored node",
    });
  }

  const regionIds = new Set<string>();
  for (const region of doc.regions) {
    if (regionIds.has(region.id)) {
      issues.push({
        code: "duplicate-region-id",
        message: `Duplicate region id ${region.id}`,
      });
    }
    regionIds.add(region.id);
    validateRect(issues, region.geometry, doc.canvas, `Region ${region.id}`);
  }

  const relationIds = new Set<string>();
  for (const rel of doc.relations) {
    if (relationIds.has(rel.id)) {
      issues.push({
        code: "duplicate-relation-id",
        message: `Duplicate relation id ${rel.id}`,
      });
    }
    relationIds.add(rel.id);

    if (!nodeIds.has(rel.from) || !nodeIds.has(rel.to)) {
      issues.push({
        code: "dangling-relation",
        message: `Relation ${rel.id} has unresolved endpoints`,
      });
    }
    if (rel.from === rel.to) {
      issues.push({
        code: "self-relation",
        message: `Relation ${rel.id} points a node at itself`,
      });
    }

    if (doc.authority === "historical" && !rel.route) {
      issues.push({
        code: "missing-relation-geometry",
        message: `Historical relation ${rel.id} has no authored route`,
      });
    }

    if (rel.route) {
      validateRoute(issues, rel.route, doc.canvas, rel.id);
    }
  }

  const pathIds = new Set<string>();
  for (const id of doc.readingPath) {
    if (!nodeIds.has(id)) {
      issues.push({
        code: "dangling-path",
        message: `Reading path references unknown node ${id}`,
      });
    }
    if (pathIds.has(id)) {
      issues.push({
        code: "duplicate-path-entry",
        message: `Reading path repeats node ${id}`,
      });
    }
    pathIds.add(id);
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
