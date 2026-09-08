import type { HornArgument } from "../argument";
import type { HornArgumentProjectionBundle } from "./argument-bundle";
import {
  analyzeHornArgumentCausality,
  type HornArgumentCausalAnalysis,
  type HornArgumentCausalStep,
} from "./causal";
import {
  mountHornArgumentRegionCockpit,
  type HornArgumentRegionCockpitController,
} from "./regions";
import type { HornArgumentCockpitSelection } from "./cockpit";
import { forwardReadonlyProperty } from "./controller-state";

export type HornArgumentCausalCockpitController = HornArgumentRegionCockpitController & {
  readonly causal: HornArgumentCausalAnalysis;
  refreshCausalLens(): void;
};

function applyStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(element.style, styles);
}

function makeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function activeClaimIds(
  argument: HornArgument,
  streamId: string | undefined,
): string[] {
  if (streamId === undefined) return argument.claims.map((claim) => claim.id);
  const stream = argument.streams.find((candidate) => candidate.id === streamId);
  if (!stream) throw new Error(`unknown Horn argument stream: ${streamId}`);
  return stream.claimIds;
}

function claimLabel(argument: HornArgument, claimId: string): string {
  const claim = argument.claims.find((candidate) => candidate.id === claimId);
  if (!claim) return claimId;
  const number = claim.extensions?.boxNumber;
  const prefix = typeof number === "number" ? `${number}. ` : "";
  return `${prefix}${claim.title ?? claim.id}`;
}

function relationLabel(step: HornArgumentCausalStep): string {
  if (step.kind === "supports") return "supports";
  if (step.kind === "disputes") return "disputes";
  return "backs";
}

/**
 * Adds a projection-only causal reasoning lens over the region-aware cockpit.
 * Unrelated claims are downplayed, never removed from Horn state. The selected
 * claim's visible responder closure and its context path toward the argument
 * focus remain emphasized.
 */
export function mountHornArgumentCausalCockpit(
  element: HTMLElement,
  bundle: HornArgumentProjectionBundle,
  initialSelection: HornArgumentCockpitSelection = {},
): HornArgumentCausalCockpitController {
  const cockpit = mountHornArgumentRegionCockpit(element, bundle, initialSelection);
  const { argument } = bundle;
  let causal = analyzeHornArgumentCausality(
    argument,
    cockpit.claimId,
    activeClaimIds(argument, cockpit.streamId),
  );
  let disposed = false;

  const compute = (): HornArgumentCausalAnalysis =>
    analyzeHornArgumentCausality(
      argument,
      cockpit.claimId,
      activeClaimIds(argument, cockpit.streamId),
    );

  const highlightCausalLens = (): void => {
    if (disposed) return;
    causal = compute();
    cockpit.map.chart.dispatchAction({
      type: "downplay",
      seriesId: "horn-argument-artifact",
    });
    for (const claimId of causal.causalClaimIds) {
      cockpit.map.chart.dispatchAction({
        type: "highlight",
        seriesId: "horn-argument-artifact",
        name: claimId,
      });
    }
  };

  const decorateInspector = (): void => {
    if (disposed) return;
    causal = compute();
    const inspector = element.querySelector<HTMLElement>(
      '[aria-label="Horn claim inspector"]',
    );
    if (!inspector) return;

    inspector.querySelector('[data-horn-causal-vivisection="true"]')?.remove();
    const section = makeElement("section");
    section.setAttribute("data-horn-causal-vivisection", "true");
    applyStyles(section, {
      marginTop: "22px",
      paddingTop: "16px",
      borderTop: "2px solid var(--horn-cockpit-rule, #d5cdbf)",
    });

    const eyebrow = makeElement("div", "WHY THIS CLAIM?");
    applyStyles(eyebrow, {
      fontSize: "10px",
      fontWeight: "800",
      letterSpacing: "0.13em",
      opacity: "0.58",
      marginBottom: "8px",
    });
    const summary = makeElement(
      "div",
      `${causal.responderClaimIds.length} responders · ${causal.contextClaimIds.length} context claims`,
    );
    applyStyles(summary, {
      fontSize: "12px",
      lineHeight: "1.4",
      marginBottom: "12px",
      opacity: "0.72",
    });
    section.append(eyebrow, summary);

    if (cockpit.claimId === argument.focusClaimId) {
      const root = makeElement(
        "div",
        "This is the argument focus. Its causal lens contains the visible claims that bear on it.",
      );
      applyStyles(root, { fontSize: "12px", lineHeight: "1.5" });
      section.append(root);
    } else if (!causal.reachesFocus) {
      const disconnected = makeElement(
        "div",
        "No visible semantic path reaches the argument focus in the active issue stream.",
      );
      applyStyles(disconnected, { fontSize: "12px", lineHeight: "1.5" });
      section.append(disconnected);
    } else {
      const start = makeElement("div", claimLabel(argument, cockpit.claimId));
      applyStyles(start, { fontSize: "12px", fontWeight: "700", marginBottom: "6px" });
      section.append(start);

      for (const step of causal.whyPath) {
        const move = makeElement("div", `↓ ${relationLabel(step)}`);
        applyStyles(move, {
          fontSize: "10px",
          fontWeight: "800",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: "0.55",
          margin: "4px 0",
        });
        const target = makeElement("button", claimLabel(argument, step.to));
        target.type = "button";
        target.setAttribute("data-causal-claim-id", step.to);
        applyStyles(target, {
          display: "block",
          width: "100%",
          padding: "7px 9px",
          border: "1px solid var(--horn-cockpit-rule, #ded8cc)",
          borderRadius: "5px",
          background: "transparent",
          color: "inherit",
          font: "inherit",
          fontSize: "12px",
          fontWeight: step.to === argument.focusClaimId ? "700" : "500",
          textAlign: "left",
          cursor: "pointer",
        });
        target.addEventListener("click", () => controller.selectClaim(step.to));
        section.append(move, target);
      }
    }

    inspector.append(section);
  };

  const refresh = (): void => {
    highlightCausalLens();
    decorateInspector();
  };

  const controller: HornArgumentCausalCockpitController = {
    ...cockpit,
    get causal() {
      return causal;
    },
    setStream(streamId) {
      cockpit.setStream(streamId);
      refresh();
    },
    clearStream() {
      cockpit.clearStream();
      refresh();
    },
    selectClaim(claimId) {
      cockpit.selectClaim(claimId);
      refresh();
    },
    selectRegion(regionId) {
      cockpit.selectRegion(regionId);
      refresh();
    },
    clearRegion() {
      cockpit.clearRegion();
      refresh();
    },
    refreshCausalLens: refresh,
    resize() {
      cockpit.resize();
      queueMicrotask(refresh);
    },
    dispose() {
      disposed = true;
      cockpit.dispose();
    },
  };
  forwardReadonlyProperty(controller, cockpit, "streamId");
  forwardReadonlyProperty(controller, cockpit, "claimId");
  forwardReadonlyProperty(controller, cockpit, "regionId");

  // The base cockpit owns chart/rail/region selection. Observe those UI events
  // after their handlers run and reapply the causal lens without duplicating
  // selection authority or introducing an ECharts render-event feedback loop.
  cockpit.map.chart.on("click", () => queueMicrotask(refresh));
  element.addEventListener("click", () => queueMicrotask(refresh));

  // Region hover intentionally previews a whole stream. Once the pointer exits
  // a measured overlay, restore the selected claim's causal lens.
  const regionOverlay = element.querySelector<HTMLElement>(
    '[data-horn-region-overlay="source-measurement"]',
  );
  regionOverlay?.addEventListener("mouseout", () => queueMicrotask(refresh));

  refresh();
  return controller;
}
