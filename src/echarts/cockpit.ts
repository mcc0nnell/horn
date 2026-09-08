import type { HornArgument, HornArgumentRelationKind } from "../argument";
import {
  mountHornArgumentECharts,
  type HornArgumentEChartsController,
  type HornArgumentMapSelection,
  type HornArgumentProjectionBundle,
} from "./argument-bundle";

export type HornArgumentClaimNeighbor = {
  relationId: string;
  kind: HornArgumentRelationKind;
  claimId: string;
  claimTitle: string;
};

export type HornArgumentClaimInspection = {
  id: string;
  number?: number;
  title: string;
  statement: string;
  role: HornArgument["claims"][number]["role"];
  attribution?: string;
  sourceLocator?: string;
  sourceArtifact?: string;
  origin?: HornArgument["claims"][number]["origin"];
  issueId?: string;
  sourceIds: string[];
  streamIds: string[];
  incoming: HornArgumentClaimNeighbor[];
  outgoing: HornArgumentClaimNeighbor[];
};

export type HornArgumentCockpitSelection = HornArgumentMapSelection & {
  claimId?: string;
};

export type HornArgumentCockpitController = {
  readonly map: HornArgumentEChartsController;
  readonly streamId: string | undefined;
  readonly claimId: string;
  setStream(streamId: string): void;
  clearStream(): void;
  selectClaim(claimId: string): void;
  resize(): void;
  dispose(): void;
};

function stringExtension(
  claim: HornArgument["claims"][number],
  key: string,
): string | undefined {
  const value = claim.extensions?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberExtension(
  claim: HornArgument["claims"][number],
  key: string,
): number | undefined {
  const value = claim.extensions?.[key];
  return typeof value === "number" ? value : undefined;
}

export function inspectHornArgumentClaim(
  bundle: HornArgumentProjectionBundle,
  claimId: string,
): HornArgumentClaimInspection {
  const { argument } = bundle;
  const claim = argument.claims.find((candidate) => candidate.id === claimId);
  if (!claim) {
    throw new Error(`unknown Horn argument claim: ${claimId}`);
  }

  const claimById = new Map(argument.claims.map((candidate) => [candidate.id, candidate]));
  const neighbor = (
    relationId: string,
    kind: HornArgumentRelationKind,
    otherClaimId: string,
  ): HornArgumentClaimNeighbor => {
    const other = claimById.get(otherClaimId);
    return {
      relationId,
      kind,
      claimId: otherClaimId,
      claimTitle: other?.title ?? otherClaimId,
    };
  };

  const incoming = argument.relations
    .filter((relation) => relation.to === claimId)
    .map((relation) => neighbor(relation.id, relation.kind, relation.from));
  const outgoing = argument.relations
    .filter((relation) => relation.from === claimId)
    .map((relation) => neighbor(relation.id, relation.kind, relation.to));

  const attribution = stringExtension(claim, "attribution");
  const sourceArtifact = stringExtension(claim, "sourceArtifact");
  const issueId = stringExtension(claim, "issueId");
  const number = numberExtension(claim, "boxNumber");

  return {
    id: claim.id,
    ...(number === undefined ? {} : { number }),
    title: claim.title ?? claim.id,
    statement: claim.statement,
    role: claim.role,
    ...(attribution === undefined ? {} : { attribution }),
    ...(claim.sourceLocator === undefined ? {} : { sourceLocator: claim.sourceLocator }),
    ...(sourceArtifact === undefined ? {} : { sourceArtifact }),
    ...(claim.origin === undefined ? {} : { origin: claim.origin }),
    ...(issueId === undefined ? {} : { issueId }),
    sourceIds: [...claim.sourceIds],
    streamIds: argument.streams
      .filter((stream) => stream.claimIds.includes(claimId))
      .map((stream) => stream.id),
    incoming,
    outgoing,
  };
}

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
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function appendMetaRow(
  container: HTMLElement,
  label: string,
  value: string | undefined,
): void {
  if (value === undefined || value.length === 0) {
    return;
  }
  const row = makeElement("div");
  applyStyles(row, {
    display: "grid",
    gridTemplateColumns: "92px minmax(0, 1fr)",
    gap: "10px",
    padding: "6px 0",
    borderBottom: "1px solid var(--horn-cockpit-rule, #ded8cc)",
  });
  const key = makeElement("div", label);
  applyStyles(key, {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: "0.62",
  });
  const val = makeElement("div", value);
  applyStyles(val, { fontSize: "13px", lineHeight: "1.4", overflowWrap: "anywhere" });
  row.append(key, val);
  container.append(row);
}

function relationLabel(kind: HornArgumentRelationKind): string {
  if (kind === "supports") return "supports";
  if (kind === "disputes") return "disputes";
  return "backs";
}

function appendNeighborhood(
  container: HTMLElement,
  title: string,
  neighbors: HornArgumentClaimNeighbor[],
  onSelect: (claimId: string) => void,
): void {
  const heading = makeElement("h3", `${title} · ${neighbors.length}`);
  applyStyles(heading, { fontSize: "12px", margin: "20px 0 8px", letterSpacing: "0.04em" });
  container.append(heading);

  if (neighbors.length === 0) {
    const empty = makeElement("div", "None");
    applyStyles(empty, { fontSize: "12px", opacity: "0.55" });
    container.append(empty);
    return;
  }

  for (const item of neighbors) {
    const button = makeElement("button");
    button.type = "button";
    button.textContent = `${relationLabel(item.kind)} · ${item.claimTitle}`;
    button.setAttribute("data-claim-id", item.claimId);
    applyStyles(button, {
      display: "block",
      width: "100%",
      margin: "0 0 6px",
      padding: "8px 9px",
      border: "1px solid var(--horn-cockpit-rule, #ded8cc)",
      borderRadius: "5px",
      background: "transparent",
      color: "inherit",
      font: "inherit",
      fontSize: "12px",
      lineHeight: "1.35",
      textAlign: "left",
      cursor: "pointer",
    });
    button.addEventListener("click", () => onSelect(item.claimId));
    container.append(button);
  }
}

/**
 * Mounts a three-pane analytical cockpit over a HornArgument projection.
 *
 * The cockpit is deliberately projection-only: issue navigation and claim
 * selection never mutate the HornArgument or its source-layout envelope.
 */
export function mountHornArgumentCockpit(
  element: HTMLElement,
  bundle: HornArgumentProjectionBundle,
  initialSelection: HornArgumentCockpitSelection = {},
): HornArgumentCockpitController {
  const { argument } = bundle;
  const claimIds = new Set(argument.claims.map((claim) => claim.id));

  element.replaceChildren();
  applyStyles(element, {
    width: "100%",
    height: "100%",
    minHeight: "620px",
    color: "var(--horn-cockpit-ink, #211f1b)",
    background: "var(--horn-cockpit-bg, #f3efe6)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  });

  const shell = makeElement("div");
  shell.setAttribute("data-horn-cockpit", "map-1");
  applyStyles(shell, {
    display: "grid",
    gridTemplateColumns: "minmax(190px, 240px) minmax(0, 1fr) minmax(270px, 340px)",
    width: "100%",
    height: "100%",
    minHeight: "620px",
  });

  const rail = makeElement("aside");
  rail.setAttribute("aria-label", "Horn issue streams");
  applyStyles(rail, {
    overflow: "auto",
    padding: "18px 14px",
    borderRight: "1px solid var(--horn-cockpit-rule, #d5cdbf)",
    background: "var(--horn-cockpit-panel, #fffdf8)",
  });

  const center = makeElement("main");
  applyStyles(center, { minWidth: "0", minHeight: "0", position: "relative" });
  const chartHost = makeElement("div");
  chartHost.setAttribute("aria-label", "Horn Map 1 analytical map");
  applyStyles(chartHost, { position: "absolute", inset: "0" });
  center.append(chartHost);

  const inspector = makeElement("aside");
  inspector.setAttribute("aria-label", "Horn claim inspector");
  applyStyles(inspector, {
    overflow: "auto",
    padding: "18px 18px 24px",
    borderLeft: "1px solid var(--horn-cockpit-rule, #d5cdbf)",
    background: "var(--horn-cockpit-panel, #fffdf8)",
  });

  shell.append(rail, center, inspector);
  element.append(shell);

  const map = mountHornArgumentECharts(
    chartHost,
    bundle,
    initialSelection.streamId === undefined ? {} : { streamId: initialSelection.streamId },
  );

  let selectedClaimId = initialSelection.claimId ?? argument.focusClaimId;

  const activeStream = (): HornArgument["streams"][number] | undefined =>
    map.streamId === undefined
      ? undefined
      : argument.streams.find((stream) => stream.id === map.streamId);

  const claimIsVisible = (claimId: string): boolean => {
    const stream = activeStream();
    return stream === undefined || stream.claimIds.includes(claimId);
  };

  if (!claimIds.has(selectedClaimId)) {
    throw new Error(`unknown Horn argument claim: ${selectedClaimId}`);
  }
  if (!claimIsVisible(selectedClaimId)) {
    selectedClaimId = argument.focusClaimId;
  }

  const highlightSelection = (): void => {
    map.chart.dispatchAction({ type: "downplay", seriesId: "horn-argument-artifact" });
    map.chart.dispatchAction({
      type: "highlight",
      seriesId: "horn-argument-artifact",
      name: selectedClaimId,
    });
  };

  const renderRail = (): void => {
    rail.replaceChildren();
    const eyebrow = makeElement("div", "MAP 1 · ISSUE STREAMS");
    applyStyles(eyebrow, {
      fontSize: "10px",
      fontWeight: "800",
      letterSpacing: "0.13em",
      opacity: "0.58",
      marginBottom: "7px",
    });
    const heading = makeElement("h2", argument.issueQuestion);
    applyStyles(heading, { fontSize: "18px", lineHeight: "1.1", margin: "0 0 16px" });
    rail.append(eyebrow, heading);

    const addButton = (
      label: string,
      detail: string,
      active: boolean,
      onClick: () => void,
    ): void => {
      const button = makeElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", active ? "true" : "false");
      applyStyles(button, {
        display: "block",
        width: "100%",
        margin: "0 0 7px",
        padding: "10px 10px 9px",
        border: active
          ? "2px solid var(--horn-cockpit-accent, #8a3324)"
          : "1px solid var(--horn-cockpit-rule, #d5cdbf)",
        borderRadius: "6px",
        background: active
          ? "var(--horn-cockpit-active, #f2dfd6)"
          : "transparent",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
      });
      const name = makeElement("span", label);
      applyStyles(name, { display: "block", fontSize: "12px", fontWeight: "700", lineHeight: "1.25" });
      const meta = makeElement("span", detail);
      applyStyles(meta, { display: "block", fontSize: "10px", marginTop: "3px", opacity: "0.6" });
      button.append(name, meta);
      button.addEventListener("click", onClick);
      rail.append(button);
    };

    addButton(
      "All issues",
      `${argument.claims.length} claims · ${argument.relations.length} relations`,
      map.streamId === undefined,
      () => controller.clearStream(),
    );

    for (const stream of map.streams) {
      addButton(
        stream.title,
        `${stream.claimCount} claims${stream.sourceRegionId ? ` · ${stream.sourceRegionId}` : ""}`,
        map.streamId === stream.id,
        () => controller.setStream(stream.id),
      );
    }
  };

  const renderInspector = (): void => {
    inspector.replaceChildren();
    const inspection = inspectHornArgumentClaim(bundle, selectedClaimId);
    const eyebrow = makeElement("div", "SEMANTIC VIVISECTION");
    applyStyles(eyebrow, {
      fontSize: "10px",
      fontWeight: "800",
      letterSpacing: "0.13em",
      opacity: "0.58",
      marginBottom: "8px",
    });
    const heading = makeElement(
      "h2",
      inspection.number === undefined ? inspection.title : `${inspection.number}. ${inspection.title}`,
    );
    applyStyles(heading, { fontSize: "18px", lineHeight: "1.2", margin: "0 0 6px" });
    const role = makeElement("div", inspection.role);
    applyStyles(role, {
      display: "inline-block",
      padding: "3px 7px",
      border: "1px solid var(--horn-cockpit-rule, #d5cdbf)",
      borderRadius: "999px",
      fontSize: "10px",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
    });
    const statement = makeElement("p", inspection.statement);
    applyStyles(statement, { fontSize: "14px", lineHeight: "1.55", margin: "16px 0" });
    inspector.append(eyebrow, heading, role, statement);

    appendMetaRow(inspector, "Attribution", inspection.attribution);
    appendMetaRow(inspector, "Source", inspection.sourceLocator);
    appendMetaRow(inspector, "Artifact", inspection.sourceArtifact);
    appendMetaRow(inspector, "Origin", inspection.origin);
    appendMetaRow(inspector, "Issue", inspection.issueId);
    appendMetaRow(
      inspector,
      "Streams",
      inspection.streamIds.length === 0 ? undefined : inspection.streamIds.join(", "),
    );

    appendNeighborhood(inspector, "Incoming moves", inspection.incoming, (claimId) => {
      if (claimIsVisible(claimId)) controller.selectClaim(claimId);
    });
    appendNeighborhood(inspector, "Outgoing moves", inspection.outgoing, (claimId) => {
      if (claimIsVisible(claimId)) controller.selectClaim(claimId);
    });
  };

  const renderSelection = (): void => {
    renderRail();
    renderInspector();
    highlightSelection();
  };

  const controller: HornArgumentCockpitController = {
    map,
    get streamId() {
      return map.streamId;
    },
    get claimId() {
      return selectedClaimId;
    },
    setStream(streamId) {
      map.setStream(streamId);
      selectedClaimId = argument.focusClaimId;
      renderSelection();
    },
    clearStream() {
      map.clearStream();
      selectedClaimId = argument.focusClaimId;
      renderSelection();
    },
    selectClaim(claimId) {
      if (!claimIds.has(claimId)) {
        throw new Error(`unknown Horn argument claim: ${claimId}`);
      }
      if (!claimIsVisible(claimId)) {
        throw new Error(`Horn argument claim is outside active stream: ${claimId}`);
      }
      selectedClaimId = claimId;
      renderInspector();
      highlightSelection();
    },
    resize() {
      map.resize();
    },
    dispose() {
      map.dispose();
      element.replaceChildren();
    },
  };

  map.chart.on("click", (params) => {
    if (params.dataType === "edge") {
      return;
    }
    const claimId = params.name;
    if (typeof claimId === "string" && claimIds.has(claimId) && claimIsVisible(claimId)) {
      controller.selectClaim(claimId);
    }
  });

  renderSelection();
  return controller;
}
