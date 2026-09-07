import type { EChartsOption } from "echarts";

import type { Citation, HornDocument, HornNode } from "../types";

export type HornEChartsView = "argument" | "timeline" | "evidence";

export type HornEChartsProjection = {
  id: HornEChartsView;
  title: string;
  description: string;
  option: EChartsOption;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nodeCenter(node: HornNode): { x: number; y: number } {
  return {
    x: node.geometry.x + node.geometry.w / 2,
    y: node.geometry.y + node.geometry.h / 2,
  };
}

function nodeTooltip(node: HornNode): string {
  const attribution = [node.authorShort ?? node.author, node.year]
    .filter((value) => value !== undefined)
    .join(" · ");

  return [
    `<strong>${escapeHtml(node.label)}</strong>`,
    escapeHtml(attribution),
    escapeHtml(node.text),
  ]
    .filter((part) => part.length > 0)
    .join("<br/><br/>");
}

function citationTooltip(citation: Citation): string {
  return [
    `<strong>${escapeHtml(citation.short)}</strong>`,
    escapeHtml(citation.citation),
    String(citation.year),
  ].join("<br/><br/>");
}

export function projectArgument(document: HornDocument): EChartsOption {
  const kinds = [...new Set(document.nodes.map((node) => node.kind))];
  const categoryByKind = new Map(kinds.map((kind, index) => [kind, index]));

  return {
    animationDurationUpdate: 240,
    tooltip: { trigger: "item" },
    series: [
      {
        id: "horn-argument",
        type: "graph",
        layout: "none",
        roam: true,
        categories: kinds.map((kind) => ({ name: kind })),
        data: document.nodes.map((node) => {
          const center = nodeCenter(node);
          return {
            id: node.id,
            name: node.id,
            x: center.x,
            y: center.y,
            value: node.number,
            category: categoryByKind.get(node.kind) ?? 0,
            symbolSize: node.focus === true ? 48 : 30,
            label: {
              show: node.focus === true,
              formatter: node.label,
              position: "bottom",
            },
            tooltip: { formatter: nodeTooltip(node) },
          };
        }),
        links: document.relations.map((relation) => ({
          id: relation.id,
          source: relation.from,
          target: relation.to,
          value: relation.kind,
          label: {
            show: true,
            formatter: relation.label,
          },
        })),
        lineStyle: {
          opacity: 0.55,
          width: 1.5,
          curveness: 0,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 3 },
        },
      },
    ],
  };
}

export function projectTimeline(document: HornDocument): EChartsOption {
  const datedNodes = document.nodes
    .filter((node): node is HornNode & { year: number } => node.year !== undefined)
    .sort((left, right) => left.year - right.year || left.number - right.number);

  return {
    animationDurationUpdate: 240,
    tooltip: { trigger: "item" },
    xAxis: {
      type: "value",
      name: "Year",
      min: "dataMin",
      max: "dataMax",
    },
    yAxis: {
      type: "value",
      name: "Claim",
      inverse: true,
      min: 0,
      max: Math.max(1, ...document.nodes.map((node) => node.number + 1)),
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", xAxisIndex: 0 },
    ],
    series: [
      {
        id: "horn-timeline",
        type: "scatter",
        symbolSize: 22,
        data: datedNodes.map((node) => ({
          id: node.id,
          name: node.id,
          value: [node.year, node.number],
          label: {
            show: true,
            formatter: node.label,
            position: "right",
          },
          tooltip: { formatter: nodeTooltip(node) },
        })),
        emphasis: {
          focus: "self",
        },
      },
    ],
  };
}

export function projectEvidence(document: HornDocument): EChartsOption {
  const citationsById = new Map(
    document.citations.map((citation) => [citation.id, citation]),
  );
  const citedIds = new Set(document.nodes.flatMap((node) => node.citationIds));
  const citations = [...citedIds]
    .map((id) => citationsById.get(id))
    .filter((citation): citation is Citation => citation !== undefined);

  return {
    animationDurationUpdate: 240,
    tooltip: { trigger: "item" },
    legend: [
      {
        data: ["claim", "mapped source", "cartographic source"],
      },
    ],
    series: [
      {
        id: "horn-evidence",
        type: "graph",
        layout: "force",
        roam: true,
        force: {
          repulsion: 220,
          edgeLength: [70, 160],
        },
        categories: [
          { name: "claim" },
          { name: "mapped source" },
          { name: "cartographic source" },
        ],
        data: [
          ...document.nodes.map((node) => ({
            id: `node:${node.id}`,
            name: `node:${node.id}`,
            value: node.number,
            category: 0,
            symbolSize: node.focus === true ? 44 : 28,
            label: {
              show: node.focus === true,
              formatter: node.label,
            },
            tooltip: { formatter: nodeTooltip(node) },
          })),
          ...citations.map((citation) => ({
            id: `citation:${citation.id}`,
            name: `citation:${citation.id}`,
            value: citation.year,
            category: citation.layer === "mapped" ? 1 : 2,
            symbol: "diamond",
            symbolSize: 24,
            label: {
              show: false,
              formatter: citation.short,
            },
            tooltip: { formatter: citationTooltip(citation) },
          })),
        ],
        links: document.nodes.flatMap((node) =>
          node.citationIds
            .filter((citationId) => citationsById.has(citationId))
            .map((citationId) => ({
              id: `evidence:${citationId}:${node.id}`,
              source: `citation:${citationId}`,
              target: `node:${node.id}`,
              value: "cites",
            })),
        ),
        lineStyle: {
          opacity: 0.45,
          width: 1.25,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 3 },
        },
      },
    ],
  };
}

export function projectHornDocument(
  document: HornDocument,
): Record<HornEChartsView, HornEChartsProjection> {
  return {
    argument: {
      id: "argument",
      title: "Argument",
      description:
        "Analytical topology using authored node centers; relation routes are intentionally abstracted.",
      option: projectArgument(document),
    },
    timeline: {
      id: "timeline",
      title: "Timeline",
      description:
        "Chronological projection of dated claims without changing the Horn document.",
      option: projectTimeline(document),
    },
    evidence: {
      id: "evidence",
      title: "Evidence",
      description:
        "Derived source-to-claim network across mapped and cartographic provenance layers.",
      option: projectEvidence(document),
    },
  };
}
