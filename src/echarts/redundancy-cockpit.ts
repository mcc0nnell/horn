import type { HornArgument } from "../argument";
import type { HornArgumentProjectionBundle } from "./argument-bundle";
import type { HornArgumentCockpitSelection } from "./cockpit";
import { forwardReadonlyProperty } from "./controller-state";
import {
  analyzeHornArgumentRedundancy,
  type HornArgumentPairCutSet,
  type HornArgumentRedundancyAnalysis,
} from "./redundancy";
import {
  mountHornArgumentSensitivityCockpit,
  type HornArgumentSensitivityCockpitController,
} from "./sensitivity-cockpit";

export type HornArgumentRedundancyCockpitController =
  HornArgumentSensitivityCockpitController & {
    readonly redundancy: HornArgumentRedundancyAnalysis;
    refreshRedundancy(): void;
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

function appendPairCut(
  container: HTMLElement,
  argument: HornArgument,
  cut: HornArgumentPairCutSet,
): void {
  const item = makeElement("div");
  applyStyles(item, {
    margin: "0 0 7px",
    padding: "7px 8px",
    border: "1px solid var(--horn-cockpit-rule, #d5cdbf)",
    borderRadius: "5px",
  });
  const pair = makeElement(
    "div",
    `${claimLabel(argument, cut.claimIds[0])} + ${claimLabel(argument, cut.claimIds[1])}`,
  );
  applyStyles(pair, {
    fontSize: "10px",
    fontWeight: "700",
    lineHeight: "1.35",
  });
  const detail = makeElement(
    "div",
    `${cut.jointOnlyCount} claim${cut.jointOnlyCount === 1 ? "" : "s"} lose focus connectivity only when both are removed`,
  );
  applyStyles(detail, {
    marginTop: "3px",
    fontSize: "9px",
    lineHeight: "1.35",
    opacity: "0.62",
  });
  item.append(pair, detail);
  container.append(item);
}

/**
 * Adds structural route redundancy and minimal two-claim cut-set inspection over
 * the sensitivity cockpit. A cut set says only that routes disappear together;
 * it does not say that claims are semantically interchangeable evidence.
 */
export function mountHornArgumentRedundancyCockpit(
  element: HTMLElement,
  bundle: HornArgumentProjectionBundle,
  initialSelection: HornArgumentCockpitSelection = {},
): HornArgumentRedundancyCockpitController {
  const cockpit = mountHornArgumentSensitivityCockpit(
    element,
    bundle,
    initialSelection,
  );
  const { argument } = bundle;
  let redundancy = analyzeHornArgumentRedundancy(
    argument,
    activeClaimIds(argument, cockpit.streamId),
  );
  let disposed = false;
  let controller: HornArgumentRedundancyCockpitController;

  const recompute = (): void => {
    redundancy = analyzeHornArgumentRedundancy(
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

    rail.querySelector('[data-horn-redundancy="true"]')?.remove();
    const section = makeElement("section");
    section.setAttribute("data-horn-redundancy", "true");
    applyStyles(section, {
      marginTop: "18px",
      paddingTop: "14px",
      borderTop: "2px solid var(--horn-cockpit-rule, #d5cdbf)",
    });

    const eyebrow = makeElement("div", "ROUTE REDUNDANCY");
    applyStyles(eyebrow, {
      fontSize: "10px",
      fontWeight: "800",
      letterSpacing: "0.12em",
      opacity: "0.58",
      marginBottom: "6px",
    });
    const topology = makeElement(
      "div",
      redundancy.rootedArborescence
        ? "Rooted arborescence · one semantic route per non-focus claim"
        : "General semantic graph · alternate routes may exist",
    );
    applyStyles(topology, {
      fontSize: "10px",
      fontWeight: "700",
      lineHeight: "1.4",
      marginBottom: "7px",
    });
    const counts = makeElement(
      "div",
      `${redundancy.singleCutTargetClaimIds.length} targets have a 1-claim intermediary cut · ${redundancy.pairCutTargetClaimIds.length} targets require a minimal 2-claim cut · ${redundancy.noIntermediaryCutUpTo2ClaimIds.length} have no intermediary cut up to size 2`,
    );
    applyStyles(counts, {
      fontSize: "9px",
      lineHeight: "1.45",
      opacity: "0.64",
      marginBottom: "8px",
    });
    section.append(eyebrow, topology, counts);

    if (redundancy.pairCutSets.length === 0) {
      const empty = makeElement(
        "div",
        redundancy.rootedArborescence
          ? "No pair-only cut sets: this lens contains no alternate semantic route that survives either cut alone."
          : "No minimal two-claim cut sets found in the active lens.",
      );
      applyStyles(empty, {
        fontSize: "9px",
        lineHeight: "1.45",
        opacity: "0.6",
      });
      section.append(empty);
    } else {
      const heading = makeElement("h3", "Minimal 2-claim cuts");
      applyStyles(heading, {
        fontSize: "11px",
        margin: "10px 0 7px",
        letterSpacing: "0.04em",
      });
      section.append(heading);
      for (const cut of redundancy.pairCutSets.slice(0, 5)) {
        appendPairCut(section, argument, cut);
      }
    }

    rail.append(section);
  };

  const refresh = (): void => {
    decorateRail();
  };

  controller = {
    ...cockpit,
    get redundancy() {
      return redundancy;
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
    refreshSensitivity() {
      cockpit.refreshSensitivity();
      refresh();
    },
    refreshRedundancy: refresh,
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
  forwardReadonlyProperty(controller, cockpit, "sensitivity");

  decorateRail();
  return controller;
}
