import type { HornArgument } from "../argument";
import type { HornArgumentProjectionBundle } from "./argument-bundle";
import type { HornArgumentCockpitSelection } from "./cockpit";
import {
  mountHornArgumentCounterfactualCockpit,
  type HornArgumentCounterfactualCockpitController,
} from "./counterfactual-cockpit";
import {
  analyzeHornArgumentSensitivity,
  analyzeHornArgumentStreamSensitivity,
  rankHornArgumentStreamFragility,
  type HornArgumentSensitivityAnalysis,
  type HornArgumentStreamSensitivity,
} from "./sensitivity";
import { forwardReadonlyProperty } from "./controller-state";

export type HornArgumentSensitivityCockpitController =
  HornArgumentCounterfactualCockpitController & {
    readonly sensitivity: HornArgumentSensitivityAnalysis;
    readonly streamSensitivity: HornArgumentStreamSensitivity[];
    refreshSensitivity(): void;
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
): string[] | undefined {
  if (streamId === undefined) return undefined;
  const stream = argument.streams.find((candidate) => candidate.id === streamId);
  if (!stream) throw new Error(`unknown Horn argument stream: ${streamId}`);
  return stream.claimIds;
}

function claimLabel(argument: HornArgument, claimId: string): string {
  const claim = argument.claims.find((candidate) => candidate.id === claimId);
  if (!claim) return claimId;
  const number = claim.extensions?.boxNumber;
  const prefix = typeof number === "number" ? `${number}. ` : "";
  return `${prefix}${claim.title ?? claim.statement ?? claim.id}`;
}

function appendRankingButton(
  container: HTMLElement,
  label: string,
  detail: string,
  onClick: () => void,
): void {
  const button = makeElement("button");
  button.type = "button";
  applyStyles(button, {
    display: "block",
    width: "100%",
    margin: "0 0 6px",
    padding: "8px 9px",
    border: "1px solid var(--horn-cockpit-rule, #d5cdbf)",
    borderRadius: "5px",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  });
  const title = makeElement("span", label);
  applyStyles(title, {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    lineHeight: "1.3",
  });
  const meta = makeElement("span", detail);
  applyStyles(meta, {
    display: "block",
    marginTop: "3px",
    fontSize: "9px",
    lineHeight: "1.35",
    opacity: "0.62",
  });
  button.append(title, meta);
  button.addEventListener("click", onClick);
  container.append(button);
}

/**
 * Adds a map-wide structural stress-test surface over the counterfactual
 * cockpit. Rankings are deterministic structural counts only: they are not
 * truth, probability, confidence, evidence weight, or semantic importance.
 */
export function mountHornArgumentSensitivityCockpit(
  element: HTMLElement,
  bundle: HornArgumentProjectionBundle,
  initialSelection: HornArgumentCockpitSelection = {},
): HornArgumentSensitivityCockpitController {
  const cockpit = mountHornArgumentCounterfactualCockpit(
    element,
    bundle,
    initialSelection,
  );
  const { argument } = bundle;
  const streamSensitivity = analyzeHornArgumentStreamSensitivity(argument);
  let sensitivity = analyzeHornArgumentSensitivity(
    argument,
    activeClaimIds(argument, cockpit.streamId),
  );
  let disposed = false;
  let controller: HornArgumentSensitivityCockpitController;

  const recompute = (): void => {
    sensitivity = analyzeHornArgumentSensitivity(
      argument,
      activeClaimIds(argument, cockpit.streamId),
    );
  };

  const decorateRail = (): void => {
    if (disposed) return;
    recompute();
    const rail = element.querySelector<HTMLElement>(
      '[aria-label="Horn issue streams"]',
    );
    if (!rail) return;

    rail.querySelector('[data-horn-sensitivity="true"]')?.remove();
    const section = makeElement("section");
    section.setAttribute("data-horn-sensitivity", "true");
    applyStyles(section, {
      marginTop: "18px",
      paddingTop: "14px",
      borderTop: "2px solid var(--horn-cockpit-rule, #d5cdbf)",
    });

    const eyebrow = makeElement("div", "STRUCTURAL STRESS TEST");
    applyStyles(eyebrow, {
      fontSize: "10px",
      fontWeight: "800",
      letterSpacing: "0.12em",
      opacity: "0.58",
      marginBottom: "6px",
    });
    const note = makeElement(
      "div",
      "Counterfactual cascade counts only · no belief score",
    );
    applyStyles(note, {
      fontSize: "9px",
      lineHeight: "1.35",
      opacity: "0.58",
      marginBottom: "8px",
    });

    const peakRemoval = sensitivity.removalRanking[0]?.removalCascadeCount ?? 0;
    const peakInversion = sensitivity.inversionRanking[0]?.inversionCascadeCount ?? 0;
    const summary = makeElement(
      "div",
      `${sensitivity.articulationClaimIds.length} articulation points · peak remove ${peakRemoval} · peak invert ${peakInversion}`,
    );
    applyStyles(summary, {
      fontSize: "10px",
      lineHeight: "1.4",
      marginBottom: "10px",
    });
    section.append(eyebrow, note, summary);

    const hotspotHeading = makeElement("h3", "Leverage hotspots");
    applyStyles(hotspotHeading, {
      fontSize: "11px",
      margin: "0 0 7px",
      letterSpacing: "0.04em",
    });
    section.append(hotspotHeading);

    for (const claim of sensitivity.leverageRanking.slice(0, 6)) {
      appendRankingButton(
        section,
        claimLabel(argument, claim.claimId),
        `remove ${claim.removalCascadeCount} · invert ${claim.inversionCascadeCount} · leverage ${claim.structuralLeverage}${claim.articulationToFocus ? " · articulation" : ""}`,
        () => controller.selectClaim(claim.claimId),
      );
    }

    if (cockpit.streamId === undefined) {
      const streamHeading = makeElement("h3", "Fragile issue streams");
      applyStyles(streamHeading, {
        fontSize: "11px",
        margin: "14px 0 7px",
        letterSpacing: "0.04em",
      });
      section.append(streamHeading);

      for (const stream of rankHornArgumentStreamFragility(streamSensitivity)
        .filter((candidate) => candidate.analyzable)
        .slice(0, 5)) {
        appendRankingButton(
          section,
          stream.title,
          `${stream.articulationCount} articulation · max remove ${stream.maxRemovalCascade} · max invert ${stream.maxInversionCascade}`,
          () => controller.setStream(stream.streamId),
        );
      }
    }

    rail.append(section);
  };

  const refresh = (): void => {
    decorateRail();
  };

  controller = {
    ...cockpit,
    get sensitivity() {
      return sensitivity;
    },
    streamSensitivity,
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
    refreshSensitivity: refresh,
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
  forwardReadonlyProperty(controller, cockpit, "causal");
  forwardReadonlyProperty(controller, cockpit, "counterfactual");

  decorateRail();
  return controller;
}
