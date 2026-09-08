import * as echarts from "echarts";
import type { ECharts, EChartsOption } from "echarts";

import type { HornArgument } from "../argument";

export type HornArgumentLayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type HornArgumentProjectionBundle = {
  version: "horn-echarts-argument-bundle/0.1";
  argument: HornArgument;
  sourceLayout?: {
    kind: "source-measurement";
    authority: "analytical-hint-only";
    canvas: {
      width: number;
      height: number;
      origin: "top-left";
      unit: string;
    };
    nodes: Array<{
      id: string;
      number: number;
      bbox: HornArgumentLayoutRect;
      provenance: "source-measurement";
    }>;
    regions: Array<{
      id: string;
      label: string;
      geometry: HornArgumentLayoutRect;
      provenance: "measured-source-raster";
    }>;
    note: string;
  };
};

export type HornArgumentMapSelection = {
  streamId?: string;
};

export type HornArgumentStreamSummary = {
  id: string;
  title: string;
  claimCount: number;
  sourceRegionId?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function claimTooltip(claim: HornArgument["claims"][number]): string {
  const attribution = claim.extensions?.attribution;
  const parts = [
    `<strong>${escapeHtml(claim.title ?? claim.id)}</strong>`,
    typeof attribution === "string" && attribution.length > 0
      ? escapeHtml(attribution)
      : "",
    escapeHtml(claim.statement),
    claim.sourceLocator ? escapeHtml(claim.sourceLocator) : "",
  ];
  return parts.filter(Boolean).join("<br/><br/>");
}

function streamSourceRegionId(
  stream: HornArgument["streams"][number],
): string | undefined {
  const value = stream.extensions?.sourceRegionId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveStream(
  argument: HornArgument,
  streamId: string | undefined,
): HornArgument["streams"][number] | undefined {
  if (streamId === undefined) {
    return undefined;
  }
  const stream = argument.streams.find((candidate) => candidate.id === streamId);
  if (!stream) {
    throw new Error(`unknown Horn argument stream: ${streamId}`);
  }
  return stream;
}

export function listHornArgumentStreams(
  bundle: HornArgumentProjectionBundle,
): HornArgumentStreamSummary[] {
  return bundle.argument.streams.map((stream) => {
    const sourceRegionId = streamSourceRegionId(stream);
    return {
      id: stream.id,
      title: stream.title ?? stream.id,
      claimCount: stream.claimIds.length,
      ...(sourceRegionId === undefined ? {} : { sourceRegionId }),
    };
  });
}

/**
 * Analytical ECharts projection of a geometry-free HornArgument.
 *
 * Source-measurement boxes are optional projection hints. They are never
 * written back to the HornArgument and are not HornDocument cartography.
 * A selected stream filters the analytical view only; it never mutates the
 * source argument or its measured source-layout envelope.
 */
export function projectHornArgumentMap(
  bundle: HornArgumentProjectionBundle,
  selection: HornArgumentMapSelection = {},
): EChartsOption {
  const { argument, sourceLayout } = bundle;
  const selectedStream = resolveStream(argument, selection.streamId);
  const visibleClaimIds = new Set(
    selectedStream?.claimIds ?? argument.claims.map((claim) => claim.id),
  );
  const claims = argument.claims.filter((claim) => visibleClaimIds.has(claim.id));
  const relations = argument.relations.filter(
    (relation) =>
      visibleClaimIds.has(relation.from) && visibleClaimIds.has(relation.to),
  );
  const layoutById = new Map(sourceLayout?.nodes.map((node) => [node.id, node]));
  const roles = ["position", "grounds", "rebuttal", "warrant", "backing"] as const;
  const categoryByRole = new Map(roles.map((role, index) => [role, index]));

  const hasCompleteSourceLayout =
    sourceLayout !== undefined &&
    claims.every((claim) => layoutById.has(claim.id));

  return {
    animationDurationUpdate: 180,
    tooltip: { trigger: "item", confine: true },
    legend: [{ data: roles.map((role) => ({ name: role })) }],
    series: [
      {
        id: "horn-argument-artifact",
        name: selectedStream?.title ?? argument.title,
        type: "graph",
        layout: hasCompleteSourceLayout ? "none" : "force",
        roam: true,
        preserveAspect: hasCompleteSourceLayout ? "contain" : false,
        draggable: false,
        categories: roles.map((role) => ({ name: role })),
        ...(hasCompleteSourceLayout
          ? {}
          : { force: { repulsion: 260, edgeLength: [40, 120], gravity: 0.08 } }),
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 6],
        data: claims.map((claim) => {
          const layout = layoutById.get(claim.id);
          const x = layout ? layout.bbox.x + layout.bbox.w / 2 : undefined;
          const y = layout ? layout.bbox.y + layout.bbox.h / 2 : undefined;
          const boxNumber = claim.extensions?.boxNumber;
          const number = typeof boxNumber === "number" ? boxNumber : undefined;
          const focus = claim.id === argument.focusClaimId;
          return {
            id: claim.id,
            name: claim.id,
            ...(x === undefined ? {} : { x }),
            ...(y === undefined ? {} : { y }),
            ...(number === undefined ? {} : { value: number }),
            category: categoryByRole.get(claim.role) ?? 0,
            symbol: focus ? "diamond" : "circle",
            symbolSize: focus ? 42 : 18,
            label: {
              show: true,
              formatter: number === undefined ? "" : String(number),
              fontSize: focus ? 13 : 9,
            },
            tooltip: { formatter: claimTooltip(claim) },
          };
        }),
        links: relations.map((relation) => ({
          id: relation.id,
          source: relation.from,
          target: relation.to,
          lineStyle: {
            type: relation.kind === "disputes" ? "dashed" : "solid",
            width: relation.kind === "supports" ? 1.6 : 1.3,
            opacity: 0.52,
          },
        })),
        lineStyle: { opacity: 0.5 },
        emphasis: {
          focus: "adjacency",
          scale: 1.5,
          lineStyle: { width: 3, opacity: 0.9 },
        },
      },
    ],
  };
}

export type HornArgumentEChartsController = {
  chart: ECharts;
  readonly streamId: string | undefined;
  readonly streams: HornArgumentStreamSummary[];
  setStream(streamId: string): void;
  clearStream(): void;
  resize(): void;
  dispose(): void;
};

export function mountHornArgumentECharts(
  element: HTMLElement,
  bundle: HornArgumentProjectionBundle,
  initialSelection: HornArgumentMapSelection = {},
): HornArgumentEChartsController {
  const chart = echarts.init(element);
  const streams = listHornArgumentStreams(bundle);
  let currentStreamId = initialSelection.streamId;

  const render = (): void => {
    chart.clear();
    chart.setOption(
      projectHornArgumentMap(
        bundle,
        currentStreamId === undefined ? {} : { streamId: currentStreamId },
      ),
      true,
    );
  };

  render();

  return {
    chart,
    get streamId() {
      return currentStreamId;
    },
    streams,
    setStream(streamId) {
      resolveStream(bundle.argument, streamId);
      currentStreamId = streamId;
      render();
    },
    clearStream() {
      currentStreamId = undefined;
      render();
    },
    resize: () => chart.resize(),
    dispose: () => chart.dispose(),
  };
}
