import type { HornArgument, HornArgumentRelationKind } from "../argument";

export type HornArgumentCausalStep = {
  relationId: string;
  kind: HornArgumentRelationKind;
  from: string;
  to: string;
};

export type HornArgumentCausalAnalysis = {
  claimId: string;
  focusClaimId: string;
  responderClaimIds: string[];
  contextClaimIds: string[];
  causalClaimIds: string[];
  causalRelationIds: string[];
  whyPath: HornArgumentCausalStep[];
  reachesFocus: boolean;
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

function reachable(
  start: string,
  adjacency: ReadonlyMap<string, readonly HornArgumentCausalStep[]>,
  nextId: (step: HornArgumentCausalStep) => string,
): { claimIds: Set<string>; relationIds: Set<string> } {
  const claimIds = new Set<string>();
  const relationIds = new Set<string>();
  const queue = [start];
  const expanded = new Set<string>([start]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const step of adjacency.get(current) ?? []) {
      relationIds.add(step.relationId);
      const next = nextId(step);
      claimIds.add(next);
      if (!expanded.has(next)) {
        expanded.add(next);
        queue.push(next);
      }
    }
  }

  claimIds.delete(start);
  return { claimIds, relationIds };
}

function shortestPathToFocus(
  start: string,
  focus: string,
  outgoing: ReadonlyMap<string, readonly HornArgumentCausalStep[]>,
): HornArgumentCausalStep[] {
  if (start === focus) return [];

  const queue: Array<{ id: string; path: HornArgumentCausalStep[] }> = [
    { id: start, path: [] },
  ];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    for (const step of outgoing.get(current.id) ?? []) {
      const next = step.to;
      const path = [...current.path, step];
      if (next === focus) return path;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ id: next, path });
      }
    }
  }

  return [];
}

/**
 * Computes a projection-only causal lens over a HornArgument.
 *
 * Horn semantic relations point from the responding claim toward the claim it
 * bears on. Recursive incoming moves therefore identify responders/evidence
 * bearing on the selected claim, while recursive outgoing moves identify the
 * context the selected claim ultimately bears on. `whyPath` is the shortest
 * visible semantic path from the selected claim to the argument focus.
 */
export function analyzeHornArgumentCausality(
  argument: HornArgument,
  claimId: string,
  visibleClaimIds?: Iterable<string>,
): HornArgumentCausalAnalysis {
  const visible = visibleClaimSet(argument, visibleClaimIds);
  if (!visible.has(claimId)) {
    throw new Error(`Horn argument claim is outside causal lens: ${claimId}`);
  }
  if (!visible.has(argument.focusClaimId)) {
    throw new Error(`Horn argument focus is outside causal lens: ${argument.focusClaimId}`);
  }

  const incoming = new Map<string, HornArgumentCausalStep[]>();
  const outgoing = new Map<string, HornArgumentCausalStep[]>();
  const steps: HornArgumentCausalStep[] = [];

  for (const relation of argument.relations) {
    if (!visible.has(relation.from) || !visible.has(relation.to)) continue;
    const step: HornArgumentCausalStep = {
      relationId: relation.id,
      kind: relation.kind,
      from: relation.from,
      to: relation.to,
    };
    steps.push(step);
    const incomingList = incoming.get(step.to) ?? [];
    incomingList.push(step);
    incoming.set(step.to, incomingList);
    const outgoingList = outgoing.get(step.from) ?? [];
    outgoingList.push(step);
    outgoing.set(step.from, outgoingList);
  }

  const responders = reachable(claimId, incoming, (step) => step.from);
  const context = reachable(claimId, outgoing, (step) => step.to);
  const whyPath = shortestPathToFocus(claimId, argument.focusClaimId, outgoing);

  const causalClaimIds = new Set<string>([claimId]);
  for (const id of responders.claimIds) causalClaimIds.add(id);
  for (const id of context.claimIds) causalClaimIds.add(id);

  const causalRelationIds = new Set<string>();
  for (const id of responders.relationIds) causalRelationIds.add(id);
  for (const id of context.relationIds) causalRelationIds.add(id);

  return {
    claimId,
    focusClaimId: argument.focusClaimId,
    responderClaimIds: [...responders.claimIds],
    contextClaimIds: [...context.claimIds],
    causalClaimIds: [...causalClaimIds],
    causalRelationIds: [...causalRelationIds],
    whyPath,
    reachesFocus: claimId === argument.focusClaimId || whyPath.length > 0,
  };
}
