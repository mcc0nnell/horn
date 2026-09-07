import * as echarts from "echarts";
import type { ECharts } from "echarts";

import type { HornDocument } from "../types";
import {
  projectHornDocument,
  type HornEChartsView,
} from "./projections";

export type HornEChartsController = {
  readonly chart: ECharts;
  readonly view: HornEChartsView;
  setView(view: HornEChartsView): void;
  resize(): void;
  dispose(): void;
};

export function mountHornECharts(
  element: HTMLElement,
  document: HornDocument,
  initialView: HornEChartsView = "argument",
): HornEChartsController {
  const projections = projectHornDocument(document);
  const chart = echarts.init(element);
  let currentView = initialView;

  const render = (view: HornEChartsView): void => {
    currentView = view;
    chart.clear();
    chart.setOption(projections[view].option, true);
  };

  render(initialView);

  return {
    chart,
    get view() {
      return currentView;
    },
    setView(view) {
      render(view);
    },
    resize() {
      chart.resize();
    },
    dispose() {
      chart.dispose();
    },
  };
}

export type HornEChartsTriptych = {
  argument: HornEChartsController;
  timeline: HornEChartsController;
  evidence: HornEChartsController;
  focusNode(nodeId: string): void;
  clearFocus(): void;
  resize(): void;
  dispose(): void;
};

const seriesIdByView: Record<HornEChartsView, string> = {
  argument: "horn-argument",
  timeline: "horn-timeline",
  evidence: "horn-evidence",
};

function projectedNodeName(view: HornEChartsView, nodeId: string): string {
  return view === "evidence" ? `node:${nodeId}` : nodeId;
}

export function mountHornEChartsTriptych(
  elements: Record<HornEChartsView, HTMLElement>,
  document: HornDocument,
): HornEChartsTriptych {
  const argument = mountHornECharts(elements.argument, document, "argument");
  const timeline = mountHornECharts(elements.timeline, document, "timeline");
  const evidence = mountHornECharts(elements.evidence, document, "evidence");
  const controllers = { argument, timeline, evidence };
  const nodeIds = new Set(document.nodes.map((node) => node.id));

  const clearFocus = (): void => {
    for (const view of Object.keys(controllers) as HornEChartsView[]) {
      controllers[view].chart.dispatchAction({
        type: "downplay",
        seriesId: seriesIdByView[view],
      });
    }
  };

  const focusNode = (nodeId: string): void => {
    if (!nodeIds.has(nodeId)) {
      throw new Error(`unknown Horn node: ${nodeId}`);
    }

    clearFocus();

    for (const view of Object.keys(controllers) as HornEChartsView[]) {
      controllers[view].chart.dispatchAction({
        type: "highlight",
        seriesId: seriesIdByView[view],
        name: projectedNodeName(view, nodeId),
      });
    }
  };

  for (const view of Object.keys(controllers) as HornEChartsView[]) {
    controllers[view].chart.on("click", (params) => {
      const projectedName = params.name;
      if (typeof projectedName !== "string") {
        return;
      }

      const nodeId = projectedName.startsWith("node:")
        ? projectedName.slice("node:".length)
        : projectedName;

      if (nodeIds.has(nodeId)) {
        focusNode(nodeId);
      }
    });
  }

  return {
    argument,
    timeline,
    evidence,
    focusNode,
    clearFocus,
    resize() {
      for (const controller of Object.values(controllers)) {
        controller.resize();
      }
    },
    dispose() {
      for (const controller of Object.values(controllers)) {
        controller.dispose();
      }
    },
  };
}
