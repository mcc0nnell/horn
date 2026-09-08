import type { HornDocument, HornNode } from "../types.js";
import { stringifyNormalized } from "./canonical.js";
import {
  ANALYSIS_CONTRACT,
  ANALYSIS_EXTENSION,
  PROJECTION_CONTRACT,
  PROJECTION_DESCRIPTIONS,
  PROJECTION_TITLES,
  RUNTIME_API_VERSION,
  type ProjectionView,
} from "./constants.js";
import {
  allFocusThreads,
  citationById,
  nodeById,
  nodeCenter,
} from "./graph.js";

export type AnalyticalProjection = {
  id: string;
  version: typeof PROJECTION_CONTRACT;
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
  };
  target: ProjectionView;
  nodes: string[];
  relations: string[];
  extensions: {
    "x-analysis": Record<string, unknown>;
  };
};

function envelope(
  document: HornDocument,
  view: ProjectionView,
  nodes: string[],
  relations: string[],
  analysis: Record<string, unknown>,
): AnalyticalProjection {
  return {
    id: `${document.id}:${view}`,
    version: PROJECTION_CONTRACT,
    source: {
      documentId: document.id,
      documentVersion: "horn-document/0.1",
    },
    target: view,
    nodes,
    relations,
    extensions: {
      [ANALYSIS_EXTENSION]: {
        contract: ANALYSIS_CONTRACT,
        description: PROJECTION_DESCRIPTIONS[view],
        runtime: RUNTIME_API_VERSION,
        title: PROJECTION_TITLES[view],
        view,
        ...analysis,
      },
    },
  };
}

function projectArgumentView(document: HornDocument): AnalyticalProjection {
  const nodes = document.nodes.map((node) => node.id);
  const relations = document.relations.map((relation) => relation.id);
  return envelope(document, "argument", nodes, relations, {
    edges: document.relations.map((relation) => ({
      from: relation.from,
      id: relation.id,
      kind: relation.kind,
      label: relation.label,
      to: relation.to,
    })),
    placed: document.nodes.map((node) => ({
      center: nodeCenter(node),
      focus: node.focus === true,
      id: node.id,
      kind: node.kind,
      label: node.label,
      number: node.number,
    })),
  });
}

function datedNodes(document: HornDocument): Array<HornNode & { year: number }> {
  return document.nodes
    .filter((node): node is HornNode & { year: number } => node.year !== undefined)
    .sort((left, right) => left.year - right.year || left.number - right.number);
}

function projectTimelineView(document: HornDocument): AnalyticalProjection {
  const dated = datedNodes(document);
  return envelope(
    document,
    "timeline",
    dated.map((node) => node.id),
    [],
    {
      datedNodes: dated.map((node) => ({
        id: node.id,
        label: node.label,
        number: node.number,
        year: node.year,
      })),
    },
  );
}

function projectEvidenceView(document: HornDocument): AnalyticalProjection {
  const citations = citationById(document);
  const citedIds: string[] = [];
  const seen = new Set<string>();
  for (const node of document.nodes) {
    for (const citationId of node.citationIds) {
      if (seen.has(citationId) || !citations.has(citationId)) {
        continue;
      }
      seen.add(citationId);
      citedIds.push(citationId);
    }
  }

  const bindings: Array<Record<string, string>> = [];
  for (const node of document.nodes) {
    for (const citationId of node.citationIds) {
      if (!citations.has(citationId)) {
        continue;
      }
      bindings.push({
        citationId,
        id: `evidence:${citationId}:${node.id}`,
        nodeId: node.id,
      });
    }
  }

  return envelope(
    document,
    "evidence",
    document.nodes.map((node) => node.id),
    [],
    {
      bindings,
      citations: citedIds.map((id) => {
        const citation = citations.get(id);
        return {
          id,
          layer: citation?.layer,
          short: citation?.short,
          year: citation?.year,
        };
      }),
      claims: document.nodes.map((node) => ({
        citationIds: [...node.citationIds],
        focus: node.focus === true,
        id: node.id,
        label: node.label,
        number: node.number,
      })),
    },
  );
}

function projectFrontierView(document: HornDocument): AnalyticalProjection {
  const nodes = nodeById(document);
  const threads = allFocusThreads(document);
  const placed = new Map<
    string,
    {
      depth: number;
      focus: boolean;
      frontier: boolean;
      id: string;
      label: string;
      lane: number;
    }
  >();
  const readingEdges: Array<Record<string, unknown>> = [];
  const relationIds: string[] = [];
  const relationSeen = new Set<string>();
  let lane = 0;

  for (const thread of threads) {
    const frontierIds = new Set(thread.frontierNodeIds);
    for (const step of thread.steps) {
      const node = nodes.get(step.nodeId);
      if (!node || placed.has(node.id)) {
        continue;
      }
      placed.set(node.id, {
        depth: step.depth,
        focus: node.focus === true,
        frontier: frontierIds.has(node.id),
        id: node.id,
        label: node.label,
        lane,
      });
      lane += 1;

      if (step.parentNodeId && step.relationId) {
        const relation = document.relations.find(
          (candidate) => candidate.id === step.relationId,
        );
        if (step.relationId && !relationSeen.has(step.relationId)) {
          relationSeen.add(step.relationId);
          relationIds.push(step.relationId);
        }
        readingEdges.push({
          from: step.parentNodeId,
          id: `reading:${step.relationId}`,
          kind: relation?.kind ?? "response",
          relationId: step.relationId,
          to: step.nodeId,
        });
      }
    }
  }

  return envelope(
    document,
    "frontier",
    [...placed.keys()],
    relationIds,
    {
      placed: [...placed.values()],
      readingEdges,
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
    },
  );
}

export function projectAnalyticalView(
  document: HornDocument,
  view: ProjectionView,
): AnalyticalProjection {
  switch (view) {
    case "argument":
      return projectArgumentView(document);
    case "timeline":
      return projectTimelineView(document);
    case "evidence":
      return projectEvidenceView(document);
    case "frontier":
      return projectFrontierView(document);
  }
}

export function parseProjectionView(value: string): ProjectionView {
  if (
    value === "argument" ||
    value === "timeline" ||
    value === "evidence" ||
    value === "frontier"
  ) {
    return value;
  }
  throw new Error(
    `Unknown projection view ${value}. Expected argument|timeline|evidence|frontier.`,
  );
}

export function stringifyProjection(projection: AnalyticalProjection): string {
  return stringifyNormalized(projection);
}
