import type { ECharts } from "echarts";

import {
  mountHornArgumentCockpit,
  type HornArgumentCockpitController,
  type HornArgumentCockpitSelection,
} from "./cockpit";
import type {
  HornArgumentLayoutRect,
  HornArgumentProjectionBundle,
} from "./argument-bundle";
import { forwardReadonlyProperty } from "./controller-state";

export type HornArgumentRegionSummary = {
  id: string;
  label: string;
  geometry: HornArgumentLayoutRect;
  streamIds: string[];
};

export type HornArgumentRegionCockpitController = HornArgumentCockpitController & {
  readonly regions: HornArgumentRegionSummary[];
  readonly regionId: string | undefined;
  selectRegion(regionId: string): void;
  clearRegion(): void;
};

export function listHornArgumentRegions(
  bundle: HornArgumentProjectionBundle,
): HornArgumentRegionSummary[] {
  const streamIdsByRegion = new Map<string, string[]>();
  for (const stream of bundle.argument.streams) {
    const value = stream.extensions?.sourceRegionId;
    if (typeof value !== "string" || value.length === 0) continue;
    const ids = streamIdsByRegion.get(value) ?? [];
    ids.push(stream.id);
    streamIdsByRegion.set(value, ids);
  }

  return (bundle.sourceLayout?.regions ?? []).map((region) => ({
    id: region.id,
    label: region.label,
    geometry: { ...region.geometry },
    streamIds: [...(streamIdsByRegion.get(region.id) ?? [])],
  }));
}

type HornEChartsPixelApi = ECharts & {
  convertToPixel(finder: { seriesId: string }, value: [number, number]): unknown;
};

function sourcePointToPixel(
  chart: HornEChartsPixelApi,
  x: number,
  y: number,
): [number, number] | undefined {
  const converted = chart.convertToPixel(
    { seriesId: "horn-argument-artifact" },
    [x, y],
  );
  if (
    !Array.isArray(converted) ||
    converted.length < 2 ||
    typeof converted[0] !== "number" ||
    typeof converted[1] !== "number" ||
    !Number.isFinite(converted[0]) ||
    !Number.isFinite(converted[1])
  ) {
    return undefined;
  }
  return [converted[0], converted[1]];
}

function regionPixelRect(
  chart: HornEChartsPixelApi,
  region: HornArgumentRegionSummary,
): HornArgumentLayoutRect | undefined {
  const { x, y, w, h } = region.geometry;
  const a = sourcePointToPixel(chart, x, y);
  const b = sourcePointToPixel(chart, x + w, y + h);
  if (!a || !b) return undefined;
  return {
    x: Math.min(a[0], b[0]),
    y: Math.min(a[1], b[1]),
    w: Math.abs(b[0] - a[0]),
    h: Math.abs(b[1] - a[1]),
  };
}

function applyStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(element.style, styles);
}

function streamClaims(
  bundle: HornArgumentProjectionBundle,
  streamIds: readonly string[],
): string[] {
  const selected = new Set(streamIds);
  return [
    ...new Set(
      bundle.argument.streams
        .filter((stream) => selected.has(stream.id))
        .flatMap((stream) => stream.claimIds),
    ),
  ];
}

/**
 * Adds measured source-region interaction over the semantic Map 1 cockpit.
 * Region rectangles remain disposable projection hints and never become Horn
 * document geometry.
 */
export function mountHornArgumentRegionCockpit(
  element: HTMLElement,
  bundle: HornArgumentProjectionBundle,
  initialSelection: HornArgumentCockpitSelection = {},
): HornArgumentRegionCockpitController {
  const cockpit = mountHornArgumentCockpit(element, bundle, initialSelection);
  const regions = listHornArgumentRegions(bundle);
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const main = element.querySelector("main");
  if (!(main instanceof HTMLElement)) {
    cockpit.dispose();
    throw new Error("Horn cockpit map pane is missing");
  }

  const overlay = document.createElement("div");
  overlay.setAttribute("data-horn-region-overlay", "source-measurement");
  applyStyles(overlay, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: "3",
  });
  main.append(overlay);

  let selectedRegionId: string | undefined;
  let disposed = false;

  const restoreClaimHighlight = (): void => {
    cockpit.map.chart.dispatchAction({
      type: "downplay",
      seriesId: "horn-argument-artifact",
    });
    cockpit.map.chart.dispatchAction({
      type: "highlight",
      seriesId: "horn-argument-artifact",
      name: cockpit.claimId,
    });
  };

  const previewRegion = (region: HornArgumentRegionSummary): void => {
    cockpit.map.chart.dispatchAction({
      type: "downplay",
      seriesId: "horn-argument-artifact",
    });
    for (const claimId of streamClaims(bundle, region.streamIds)) {
      cockpit.map.chart.dispatchAction({
        type: "highlight",
        seriesId: "horn-argument-artifact",
        name: claimId,
      });
    }
  };

  const selectRegion = (regionId: string): void => {
    const region = regionById.get(regionId);
    if (!region) throw new Error(`unknown Horn source region: ${regionId}`);
    if (region.streamIds.length !== 1) {
      throw new Error(
        `Horn source region does not resolve to exactly one stream: ${regionId}`,
      );
    }
    selectedRegionId = region.id;
    cockpit.setStream(region.streamIds[0]!);
    renderRegions();
  };

  const clearRegion = (): void => {
    selectedRegionId = undefined;
    cockpit.clearStream();
    renderRegions();
  };

  const renderRegions = (): void => {
    if (disposed) return;
    overlay.replaceChildren();
    for (const region of regions) {
      const rect = regionPixelRect(
        cockpit.map.chart as HornEChartsPixelApi,
        region,
      );
      if (!rect || rect.w < 2 || rect.h < 2) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.title = region.label;
      button.setAttribute("aria-label", `Focus issue region: ${region.label}`);
      button.setAttribute("data-region-id", region.id);
      button.setAttribute(
        "aria-pressed",
        selectedRegionId === region.id ? "true" : "false",
      );
      applyStyles(button, {
        position: "absolute",
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        padding: "0",
        border:
          selectedRegionId === region.id
            ? "2px solid var(--horn-cockpit-accent, #8a3324)"
            : "1px dashed rgba(92, 78, 59, 0.38)",
        borderRadius: "8px",
        background:
          selectedRegionId === region.id
            ? "rgba(138, 51, 36, 0.08)"
            : "rgba(255, 253, 248, 0.025)",
        cursor: region.streamIds.length === 1 ? "pointer" : "default",
        pointerEvents: "auto",
      });
      button.addEventListener("mouseenter", () => previewRegion(region));
      button.addEventListener("mouseleave", restoreClaimHighlight);
      button.addEventListener("click", () => {
        if (region.streamIds.length === 1) selectRegion(region.id);
      });
      overlay.append(button);
    }
  };

  const syncSelectedRegion = (): void => {
    selectedRegionId = regions.find((region) =>
      region.streamIds.includes(cockpit.streamId ?? ""),
    )?.id;
    renderRegions();
  };

  cockpit.map.chart.on("graphroam", renderRegions);
  cockpit.map.chart.on("finished", renderRegions);
  queueMicrotask(renderRegions);

  const controller: HornArgumentRegionCockpitController = {
    ...cockpit,
    regions,
    get regionId() {
      return selectedRegionId;
    },
    setStream(streamId) {
      cockpit.setStream(streamId);
      syncSelectedRegion();
    },
    clearStream() {
      selectedRegionId = undefined;
      cockpit.clearStream();
      renderRegions();
    },
    selectRegion,
    clearRegion,
    resize() {
      cockpit.resize();
      renderRegions();
    },
    dispose() {
      disposed = true;
      cockpit.dispose();
    },
  };
  forwardReadonlyProperty(controller, cockpit, "streamId");
  forwardReadonlyProperty(controller, cockpit, "claimId");

  syncSelectedRegion();
  return controller;
}
