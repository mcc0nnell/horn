import type { HornArgument } from "../argument";

export type HornArgumentPairCutSet = {
  claimIds: [string, string];
  jointlyDisconnectedClaimIds: string[];
  jointOnlyDisconnectedClaimIds: string[];
  jointOnlyCount: number;
};

export type HornArgumentRedundancyAnalysis = {
  focusClaimId: string;
  visibleClaimIds: string[];
  baselineConnectedClaimIds: string[];
  rootedArborescence: boolean;
  directToFocusClaimIds: string[];
  singleCutTargetClaimIds: string[];
  pairCutTargetClaimIds: string[];
  noIntermediaryCutUpTo2ClaimIds: string[];
  pairCutSets: HornArgumentPairCutSet[];
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

function visibleOutgoing(
  argument: HornArgument,
  visible: ReadonlySet<string>,
): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  for (const relation of argument.relations) {
    if (!visible.has(relation.from) || !visible.has(relation.to)) continue;
    const list = outgoing.get(relation.from) ?? [];
    list.push(relation.to);
    outgoing.set(relation.from, list);
  }
  return outgoing;
}

function visibleIncoming(
  outgoing: ReadonlyMap<string, readonly string[]>,
): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const [from, targets] of outgoing) {
    for (const to of targets) {
      const list = incoming.get(to) ?? [];
      list.push(from);
      incoming.set(to, list);
    }
  }
  return incoming;
}

function connectedToFocus(
  focusClaimId: string,
  incoming: ReadonlyMap<string, readonly string[]>,
  removed: ReadonlySet<string>,
): Set<string> {
  if (removed.has(focusClaimId)) return new Set();
  const connected = new Set<string>([focusClaimId]);
  const queue = [focusClaimId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const responder of incoming.get(current) ?? []) {
      if (removed.has(responder) || connected.has(responder)) continue;
      connected.add(responder);
      queue.push(responder);
    }
  }
  return connected;
}

function disconnectedByRemoval(
  baselineConnected: ReadonlySet<string>,
  focusClaimId: string,
  incoming: ReadonlyMap<string, readonly string[]>,
  removed: ReadonlySet<string>,
): Set<string> {
  const stillConnected = connectedToFocus(focusClaimId, incoming, removed);
  const disconnected = new Set<string>();
  for (const claimId of baselineConnected) {
    if (removed.has(claimId) || claimId === focusClaimId) continue;
    if (!stillConnected.has(claimId)) disconnected.add(claimId);
  }
  return disconnected;
}

/**
 * Finds intermediary single-node cuts and minimal two-node cuts to the argument
 * focus. Cut members and the focus are excluded as targets, so a pair cut means
 * two other claims are jointly necessary to preserve a target claim's route.
 *
 * This is structural reachability only. It does not imply that two claims are
 * evidentially interchangeable or semantically redundant.
 */
export function analyzeHornArgumentRedundancy(
  argument: HornArgument,
  visibleClaimIds?: Iterable<string>,
): HornArgumentRedundancyAnalysis {
  const visible = visibleClaimSet(argument, visibleClaimIds);
  if (!visible.has(argument.focusClaimId)) {
    throw new Error(`Horn argument focus is outside redundancy lens: ${argument.focusClaimId}`);
  }

  const outgoing = visibleOutgoing(argument, visible);
  const incoming = visibleIncoming(outgoing);
  const none = new Set<string>();
  const baselineConnected = connectedToFocus(argument.focusClaimId, incoming, none);

  const nonFocus = [...visible].filter((id) => id !== argument.focusClaimId);
  const singleDisconnected = new Map<string, Set<string>>();
  const singleCutTargets = new Set<string>();
  for (const cutId of nonFocus) {
    const disconnected = disconnectedByRemoval(
      baselineConnected,
      argument.focusClaimId,
      incoming,
      new Set([cutId]),
    );
    singleDisconnected.set(cutId, disconnected);
    for (const targetId of disconnected) {
      if (targetId !== cutId) singleCutTargets.add(targetId);
    }
  }

  const pairCutSets: HornArgumentPairCutSet[] = [];
  const pairCutTargets = new Set<string>();
  for (let i = 0; i < nonFocus.length; i += 1) {
    const a = nonFocus[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < nonFocus.length; j += 1) {
      const b = nonFocus[j];
      if (b === undefined) continue;
      const jointlyDisconnected = disconnectedByRemoval(
        baselineConnected,
        argument.focusClaimId,
        incoming,
        new Set([a, b]),
      );
      if (jointlyDisconnected.size === 0) continue;

      const aDisconnected = singleDisconnected.get(a) ?? none;
      const bDisconnected = singleDisconnected.get(b) ?? none;
      const jointOnlyDisconnectedClaimIds = [...jointlyDisconnected].filter(
        (targetId) =>
          targetId !== a &&
          targetId !== b &&
          !aDisconnected.has(targetId) &&
          !bDisconnected.has(targetId),
      );
      if (jointOnlyDisconnectedClaimIds.length === 0) continue;

      for (const targetId of jointOnlyDisconnectedClaimIds) {
        pairCutTargets.add(targetId);
      }
      pairCutSets.push({
        claimIds: [a, b],
        jointlyDisconnectedClaimIds: [...jointlyDisconnected].sort(),
        jointOnlyDisconnectedClaimIds: [...jointOnlyDisconnectedClaimIds].sort(),
        jointOnlyCount: jointOnlyDisconnectedClaimIds.length,
      });
    }
  }

  pairCutSets.sort(
    (a, b) =>
      b.jointOnlyCount - a.jointOnlyCount ||
      a.claimIds[0].localeCompare(b.claimIds[0]) ||
      a.claimIds[1].localeCompare(b.claimIds[1]),
  );

  const directToFocusClaimIds = nonFocus.filter((claimId) =>
    (outgoing.get(claimId) ?? []).includes(argument.focusClaimId),
  );
  const rootedArborescence =
    baselineConnected.size === visible.size &&
    (outgoing.get(argument.focusClaimId) ?? []).length === 0 &&
    nonFocus.every((claimId) => (outgoing.get(claimId) ?? []).length === 1);

  const noIntermediaryCutUpTo2ClaimIds = [...baselineConnected]
    .filter((claimId) => claimId !== argument.focusClaimId)
    .filter((claimId) => !singleCutTargets.has(claimId) && !pairCutTargets.has(claimId))
    .sort();

  return {
    focusClaimId: argument.focusClaimId,
    visibleClaimIds: [...visible],
    baselineConnectedClaimIds: [...baselineConnected],
    rootedArborescence,
    directToFocusClaimIds: [...directToFocusClaimIds].sort(),
    singleCutTargetClaimIds: [...singleCutTargets].sort(),
    pairCutTargetClaimIds: [...pairCutTargets].sort(),
    noIntermediaryCutUpTo2ClaimIds,
    pairCutSets,
  };
}
