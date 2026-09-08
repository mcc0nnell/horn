import type { HornArgument } from "../argument";
import type { HornArgumentProjectionBundle } from "./argument-bundle";
import type { HornArgumentCockpitSelection } from "./cockpit";
import {
  mountHornArgumentCausalCockpit,
  type HornArgumentCausalCockpitController,
} from "./causal-cockpit";
import {
  analyzeHornArgumentCounterfactual,
  type HornArgumentCounterfactualAnalysis,
  type HornArgumentCounterfactualMode,
} from "./counterfactual";
import { forwardReadonlyProperty } from "./controller-state";

export type HornArgumentCounterfactualCockpitController =
  HornArgumentCausalCockpitController & {
    readonly counterfactual: HornArgumentCounterfactualAnalysis | undefined;
    simulateCounterfactual(mode: HornArgumentCounterfactualMode): void;
    clearCounterfactual(): void;
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

function appendButton(
  container: HTMLElement,
  label: string,
  onClick: () => void,
  disabled = false,
): HTMLButtonElement {
  const button = makeElement("button", label);
  button.type = "button";
  button.disabled = disabled;
  applyStyles(button, {
    display: "inline-block",
    margin: "0 6px 6px 0",
    padding: "7px 9px",
    border: "1px solid var(--horn-cockpit-rule, #d5cdbf)",
    borderRadius: "5px",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontSize: "11px",
    fontWeight: "700",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? "0.45" : "1",
  });
  if (!disabled) button.addEventListener("click", onClick);
  container.append(button);
  return button;
}

/**
 * Adds reversible hypothetical removal/inversion over the causal cockpit.
 * Counterfactuals never mutate the canonical HornArgument and never claim a
 * truth-value or confidence outcome.
 */
export function mountHornArgumentCounterfactualCockpit(
  element: HTMLElement,
  bundle: HornArgumentProjectionBundle,
  initialSelection: HornArgumentCockpitSelection = {},
): HornArgumentCounterfactualCockpitController {
  const cockpit = mountHornArgumentCausalCockpit(element, bundle, initialSelection);
  const { argument } = bundle;
  let counterfactual: HornArgumentCounterfactualAnalysis | undefined;
  let disposed = false;

  const compute = (
    mode: HornArgumentCounterfactualMode,
  ): HornArgumentCounterfactualAnalysis =>
    analyzeHornArgumentCounterfactual(
      argument,
      cockpit.claimId,
      mode,
      activeClaimIds(argument, cockpit.streamId),
    );

  const applyCounterfactualLens = (): void => {
    if (disposed || counterfactual === undefined) return;
    cockpit.map.chart.dispatchAction({
      type: "downplay",
      seriesId: "horn-argument-artifact",
    });
    const highlighted = new Set(counterfactual.affectedClaimIds);
    highlighted.add(argument.focusClaimId);
    for (const claimId of highlighted) {
      cockpit.map.chart.dispatchAction({
        type: "highlight",
        seriesId: "horn-argument-artifact",
        name: claimId,
      });
    }
  };

  let controller: HornArgumentCounterfactualCockpitController;

  const decorateInspector = (): void => {
    if (disposed) return;
    const inspector = element.querySelector<HTMLElement>(
      '[aria-label="Horn claim inspector"]',
    );
    if (!inspector) return;

    inspector.querySelector('[data-horn-counterfactual="true"]')?.remove();
    const section = makeElement("section");
    section.setAttribute("data-horn-counterfactual", "true");
    applyStyles(section, {
      marginTop: "22px",
      paddingTop: "16px",
      borderTop: "2px solid var(--horn-cockpit-rule, #d5cdbf)",
    });

    const eyebrow = makeElement("div", "COUNTERFACTUAL VIVISECTION");
    applyStyles(eyebrow, {
      fontSize: "10px",
      fontWeight: "800",
      letterSpacing: "0.13em",
      opacity: "0.58",
      marginBottom: "8px",
    });
    const warning = makeElement(
      "div",
      "Hypothesis only · canonical Horn argument remains unchanged",
    );
    applyStyles(warning, {
      fontSize: "11px",
      lineHeight: "1.4",
      marginBottom: "10px",
      opacity: "0.68",
    });
    section.append(eyebrow, warning);

    const isFocus = cockpit.claimId === argument.focusClaimId;
    appendButton(
      section,
      "Remove this claim",
      () => controller.simulateCounterfactual("remove"),
      isFocus,
    );
    appendButton(
      section,
      "Invert its move",
      () => controller.simulateCounterfactual("invert"),
      isFocus,
    );

    if (counterfactual !== undefined) {
      appendButton(section, "Clear hypothesis", () => controller.clearCounterfactual());
      const heading = makeElement(
        "h3",
        counterfactual.mode === "remove" ? "If this claim vanished" : "If this move inverted",
      );
      applyStyles(heading, {
        fontSize: "13px",
        lineHeight: "1.35",
        margin: "10px 0 7px",
      });
      section.append(heading);

      if (counterfactual.mode === "remove") {
        const result = makeElement(
          "div",
          `${counterfactual.disconnectedClaimIds.length} remaining claims lose their visible semantic path to the focus.`,
        );
        applyStyles(result, { fontSize: "12px", lineHeight: "1.5", marginBottom: "8px" });
        section.append(result);
      } else {
        const original = counterfactual.originalMove?.kind ?? "unknown";
        const hypothetical = counterfactual.hypotheticalMove?.kind ?? "unknown";
        const result = makeElement(
          "div",
          `${original} → ${hypothetical}; ${counterfactual.orientationChangedClaimIds.length} claims inherit the changed orientation toward the focus.`,
        );
        applyStyles(result, { fontSize: "12px", lineHeight: "1.5", marginBottom: "8px" });
        section.append(result);
      }

      const affectedHeading = makeElement(
        "div",
        `Affected claims · ${counterfactual.affectedClaimIds.length}`,
      );
      applyStyles(affectedHeading, {
        fontSize: "10px",
        fontWeight: "800",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: "0.55",
        margin: "10px 0 5px",
      });
      section.append(affectedHeading);

      for (const claimId of counterfactual.affectedClaimIds.slice(0, 12)) {
        const item = makeElement("div", claimLabel(argument, claimId));
        applyStyles(item, {
          fontSize: "11px",
          lineHeight: "1.4",
          padding: "3px 0",
        });
        section.append(item);
      }
      if (counterfactual.affectedClaimIds.length > 12) {
        const remainder = makeElement(
          "div",
          `+${counterfactual.affectedClaimIds.length - 12} more`,
        );
        applyStyles(remainder, { fontSize: "11px", opacity: "0.55", marginTop: "3px" });
        section.append(remainder);
      }
    }

    inspector.append(section);
  };

  const refreshCounterfactual = (): void => {
    decorateInspector();
    if (counterfactual === undefined) {
      cockpit.refreshCausalLens();
    } else {
      applyCounterfactualLens();
    }
  };

  const clearForNavigation = (): void => {
    counterfactual = undefined;
  };

  controller = {
    ...cockpit,
    get counterfactual() {
      return counterfactual;
    },
    setStream(streamId) {
      clearForNavigation();
      cockpit.setStream(streamId);
      decorateInspector();
    },
    clearStream() {
      clearForNavigation();
      cockpit.clearStream();
      decorateInspector();
    },
    selectClaim(claimId) {
      clearForNavigation();
      cockpit.selectClaim(claimId);
      decorateInspector();
    },
    selectRegion(regionId) {
      clearForNavigation();
      cockpit.selectRegion(regionId);
      decorateInspector();
    },
    clearRegion() {
      clearForNavigation();
      cockpit.clearRegion();
      decorateInspector();
    },
    simulateCounterfactual(mode) {
      counterfactual = compute(mode);
      refreshCounterfactual();
    },
    clearCounterfactual() {
      counterfactual = undefined;
      refreshCounterfactual();
    },
    refreshCausalLens() {
      if (counterfactual === undefined) cockpit.refreshCausalLens();
      else applyCounterfactualLens();
      decorateInspector();
    },
    resize() {
      cockpit.resize();
      queueMicrotask(refreshCounterfactual);
    },
    dispose() {
      disposed = true;
      cockpit.dispose();
    },
  };
  forwardReadonlyProperty(controller, cockpit, "streamId");
  forwardReadonlyProperty(controller, cockpit, "claimId");
  forwardReadonlyProperty(controller, cockpit, "regionId");
  forwardReadonlyProperty(controller, cockpit, "causal");

  cockpit.map.chart.on("finished", () => {
    if (counterfactual !== undefined) queueMicrotask(applyCounterfactualLens);
  });
  cockpit.map.chart.on("click", () => queueMicrotask(decorateInspector));
  const regionOverlay = element.querySelector<HTMLElement>(
    '[data-horn-region-overlay="source-measurement"]',
  );
  regionOverlay?.addEventListener("mouseout", () => {
    if (counterfactual !== undefined) queueMicrotask(applyCounterfactualLens);
  });

  decorateInspector();
  return controller;
}
