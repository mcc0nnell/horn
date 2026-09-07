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
  resize(): void;
  dispose(): void;
};

export function mountHornEChartsTriptych(
  elements: Record<HornEChartsView, HTMLElement>,
  document: HornDocument,
): HornEChartsTriptych {
  const argument = mountHornECharts(elements.argument, document, "argument");
  const timeline = mountHornECharts(elements.timeline, document, "timeline");
  const evidence = mountHornECharts(elements.evidence, document, "evidence");
  const controllers = [argument, timeline, evidence];

  return {
    argument,
    timeline,
    evidence,
    resize() {
      for (const controller of controllers) {
        controller.resize();
      }
    },
    dispose() {
      for (const controller of controllers) {
        controller.dispose();
      }
    },
  };
}
