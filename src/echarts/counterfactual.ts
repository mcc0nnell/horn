import type { HornArgument, HornArgumentRelationKind } from "../argument";
import {
  analyzeHornArgumentCausality,
  type HornArgumentCausalStep,
} from "./causal";

export type HornArgumentCounterfactualMode = "remove" | "invert";

export type HornArgumentCounterfactualAnalysis = {
  mode: HornArgumentCounterfactualMode;
  claimId: string;
  focusClaimId: string;
  affectedClaimIds: string[];
  affectedRelationIds: string[];
  removedClaimIds: string[];
  disconnectedClaimIds: string[];
  orientationChangedClaimIds: string[];
  originalMove: HornArgumentCausalStep | null;
  hypotheticalMove: HornArgumentCausalStep | null;
  originalWhyPath: HornArgumentCausalStep[];
  hypotheticalWhyPath: HornArgumentCausalStep[];
  reachesFocusBefore: boolean;
  reachesFocusAfter: boolean;
};

function visibleClaimSet(
  argument: HornArgument,
  visibleClaimIds: Iterable<string> | undefined,
): Set<string> {
  const all = new Set(argument.claims.map((claim) => claim.id));
  if (visibleClaimIds === undefined) return all;
  const visible = new Set<string>();
  for (const id of visibleClaimIds) {
    if (all.has(id)) visible.add(id);
  }
  return visible;
}

function visibleSteps(
  argument: HornArgument,
  visible: ReadonlySet<string>,
): HornArgumentCausalStep[] {
  return argument.relations
    .filter((relation) => visible.has(relation.from) && visible.has(relation.to))
    .map((relation) => ({
      relationId: relation.id,
      kind: relation.kind,
      from: relation.from,
      to: relation.to,
    }));
}

function pathToFocus(
  start: string,
  focus: string,
  steps: readonly HornArgumentCausalStep[],
  visible: ReadonlySet<string>,
): HornArgumentCausalStep[] {
  if (!visible.has(start) || !visible.has(focus)) return [];
  if (start === focus) return [];

  const outgoing = new Map<string, HornArgumentCausalStep[]>();
  for (const step of steps) {
    if (!visible.has(step.from) || !visible.has(step.to)) continue;
    const list = outgoing.get(step.from) ?? [];
    list.push(step);
    outgoing.set(step.from, list);
  }

  const queue: Array<{ id: string; path: HornArgumentCausalStep[] }> = [
    { id: start, path: [] },
  ];
  const visited = new Set<string>([start]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const step of outgoing.get(current.id) ?? []) {
      const path = [...current.path, step];
      if (step.to === focus) return path;
      if (!visited.has(step.to)) {
        visited.add(step.to);
        queue.push({ id: step.to, path });
      }
    }
  }
  return [];
}

function reachesFocus(
  claimId: string,
  focusClaimId: string,
  steps: readonly HornArgumentCausalStep[],
  visible: ReadonlySet<string>,
): boolean {
  return claimId === focusClaimId || pathToFocus(claimId, focusClaimId, steps, visible).length > 0;
}

function invertKind(kind: HornArgumentRelationKind): HornArgumentRelationKind {
  if (kind === "supports") return "disputes";
  if (kind === "disputes") return "supports";
  throw new Error(`Horn relation kind is not invertible: ${kind}`);
}

/**
 * Computes a hypothetical, projection-only structural change over a HornArgument.
 * The canonical argument is never mutated and no truth or confidence calculus is
 * implied by the result.
 */
export function analyzeHornArgumentCounterfactual(
  argument: HornArgument,
  claimId: string,
  mode: HornArgumentCounterfactualMode,
  visibleClaimIds?: Iterable<string>,
): HornArgumentCounterfactualAnalysis {
  const visible = visibleClaimSet(argument, visibleClaimIds);
  if (!visible.has(claimId)) {
    throw new Error(`Horn argument claim is outside counterfactual lens: ${claimId}`);
  }
  if (!visible.has(argument.focusClaimId)) {
    throw new Error(`Horn argument focus is outside counterfactual lens: ${argument.focusClaimId}`);
  }
  if (claimId === argument.focusClaimId) {
    throw new Error("Horn argument focus cannot be counterfactually removed or inverted");
  }

  const baseline = analyzeHornArgumentCausality(argument, claimId, visible);
  const steps = visibleSteps(argument, visible);
  const originalWhyPath = [...baseline.whyPath];

  if (mode === "remove") {
    const hypotheticalVisible = new Set(visible);
    hypotheticalVisible.delete(claimId);
    const hypotheticalSteps = steps.filter(
      (step) => step.from !== claimId && step.to !== claimId,
    );

    const disconnectedClaimIds = [...hypotheticalVisible].filter((id) => {
      const before = reachesFocus(id, argument.focusClaimId, steps, visible);
      const after = reachesFocus(
        id,
        argument.focusClaimId,
        hypotheticalSteps,
        hypotheticalVisible,
      );
      return before && !after;
    });
    const affected = new Set<string>([claimId, ...disconnectedClaimIds]);
    const affectedRelationIds = steps
      .filter((step) => affected.has(step.from) || affected.has(step.to))
      .map((step) => step.relationId);

    return {
      mode,
      claimId,
      focusClaimId: argument.focusClaimId,
      affectedClaimIds: [...affected],
      affectedRelationIds,
      removedClaimIds: [claimId],
      disconnectedClaimIds,
      orientationChangedClaimIds: [],
      originalMove: originalWhyPath[0] ?? null,
      hypotheticalMove: null,
      originalWhyPath,
      hypotheticalWhyPath: [],
      reachesFocusBefore: baseline.reachesFocus,
      reachesFocusAfter: false,
    };
  }

  const outgoing = steps.filter((step) => step.from === claimId);
  if (outgoing.length !== 1) {
    throw new Error(
      `Horn counterfactual inversion requires exactly one visible outgoing move: ${claimId}`,
    );
  }
  const originalMove = outgoing[0]!;
  const hypotheticalMove: HornArgumentCausalStep = {
    ...originalMove,
    kind: invertKind(originalMove.kind),
  };
  const hypotheticalWhyPath = originalWhyPath.map((step) =>
    step.relationId === originalMove.relationId ? hypotheticalMove : step,
  );
  const orientationChangedClaimIds = [claimId, ...baseline.responderClaimIds];

  return {
    mode,
    claimId,
    focusClaimId: argument.focusClaimId,
    affectedClaimIds: [...new Set(orientationChangedClaimIds)],
    affectedRelationIds: [originalMove.relationId],
    removedClaimIds: [],
    disconnectedClaimIds: [],
    orientationChangedClaimIds: [...new Set(orientationChangedClaimIds)],
    originalMove,
    hypotheticalMove,
    originalWhyPath,
    hypotheticalWhyPath,
    reachesFocusBefore: baseline.reachesFocus,
    reachesFocusAfter: baseline.reachesFocus,
  };
}
