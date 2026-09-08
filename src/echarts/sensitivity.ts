import type { HornArgument } from "../argument";
import { analyzeHornArgumentCounterfactual } from "./counterfactual";

export type HornArgumentClaimSensitivity = {
  claimId: string;
  claimTitle: string;
  streamIds: string[];
  removalCascadeClaimIds: string[];
  removalCascadeCount: number;
  inversionAvailable: boolean;
  inversionCascadeClaimIds: string[];
  inversionCascadeCount: number;
  articulationToFocus: boolean;
  structuralLeverage: number;
};

export type HornArgumentSensitivityAnalysis = {
  focusClaimId: string;
  visibleClaimIds: string[];
  claims: HornArgumentClaimSensitivity[];
  articulationClaimIds: string[];
  removalRanking: HornArgumentClaimSensitivity[];
  inversionRanking: HornArgumentClaimSensitivity[];
  leverageRanking: HornArgumentClaimSensitivity[];
};

export type HornArgumentStreamSensitivity = {
  streamId: string;
  title: string;
  claimCount: number;
  analyzable: boolean;
  articulationClaimIds: string[];
  articulationCount: number;
  maxRemovalCascade: number;
  maxInversionCascade: number;
  maxStructuralLeverage: number;
  removalHotspotClaimId?: string;
  inversionHotspotClaimId?: string;
  leverageHotspotClaimId?: string;
};

function visibleClaimSet(
  argument: HornArgument,
  visibleClaimIds: Iterable<string> | undefined,
): Set<string> {
  const all = new Set(argument.claims.map((claim) => claim.id));
  if (visibleClaimIds === undefined) return all;

  const visible = new Set<string>();
  for (const claimId of visibleClaimIds) {
    if (all.has(claimId)) visible.add(claimId);
  }
  return visible;
}

function claimTitle(argument: HornArgument, claimId: string): string {
  const claim = argument.claims.find((candidate) => candidate.id === claimId);
  return claim?.title ?? claim?.statement ?? claimId;
}

function streamIdsForClaim(argument: HornArgument, claimId: string): string[] {
  return argument.streams
    .filter((stream) => stream.claimIds.includes(claimId))
    .map((stream) => stream.id);
}

function inversionAvailable(
  argument: HornArgument,
  claimId: string,
  visible: ReadonlySet<string>,
): boolean {
  const outgoing = argument.relations.filter(
    (relation) =>
      relation.from === claimId &&
      visible.has(relation.from) &&
      visible.has(relation.to),
  );
  return (
    outgoing.length === 1 &&
    (outgoing[0]?.kind === "supports" || outgoing[0]?.kind === "disputes")
  );
}

function byRemoval(a: HornArgumentClaimSensitivity, b: HornArgumentClaimSensitivity): number {
  return (
    b.removalCascadeCount - a.removalCascadeCount ||
    b.structuralLeverage - a.structuralLeverage ||
    a.claimId.localeCompare(b.claimId)
  );
}

function byInversion(a: HornArgumentClaimSensitivity, b: HornArgumentClaimSensitivity): number {
  return (
    b.inversionCascadeCount - a.inversionCascadeCount ||
    b.structuralLeverage - a.structuralLeverage ||
    a.claimId.localeCompare(b.claimId)
  );
}

function byLeverage(a: HornArgumentClaimSensitivity, b: HornArgumentClaimSensitivity): number {
  return (
    b.structuralLeverage - a.structuralLeverage ||
    b.removalCascadeCount - a.removalCascadeCount ||
    b.inversionCascadeCount - a.inversionCascadeCount ||
    a.claimId.localeCompare(b.claimId)
  );
}

/**
 * Runs every admissible single-claim counterfactual over the visible argument.
 *
 * The resulting metrics are structural counts only. They do not represent
 * confidence, probability, truth, evidentiary weight, or semantic importance.
 * `structuralLeverage` is the larger of the removal cascade and inversion
 * responder cascade for one claim; it is deliberately not a belief score.
 */
export function analyzeHornArgumentSensitivity(
  argument: HornArgument,
  visibleClaimIds?: Iterable<string>,
): HornArgumentSensitivityAnalysis {
  const visible = visibleClaimSet(argument, visibleClaimIds);
  if (!visible.has(argument.focusClaimId)) {
    throw new Error(`Horn argument focus is outside sensitivity lens: ${argument.focusClaimId}`);
  }

  const claims: HornArgumentClaimSensitivity[] = [];
  for (const claim of argument.claims) {
    if (!visible.has(claim.id) || claim.id === argument.focusClaimId) continue;

    const removal = analyzeHornArgumentCounterfactual(
      argument,
      claim.id,
      "remove",
      visible,
    );
    const removalCascadeClaimIds = [...removal.disconnectedClaimIds];

    const canInvert = inversionAvailable(argument, claim.id, visible);
    const inversionCascadeClaimIds = canInvert
      ? analyzeHornArgumentCounterfactual(argument, claim.id, "invert", visible)
          .orientationChangedClaimIds.filter((id) => id !== claim.id)
      : [];

    const removalCascadeCount = removalCascadeClaimIds.length;
    const inversionCascadeCount = inversionCascadeClaimIds.length;
    claims.push({
      claimId: claim.id,
      claimTitle: claimTitle(argument, claim.id),
      streamIds: streamIdsForClaim(argument, claim.id),
      removalCascadeClaimIds,
      removalCascadeCount,
      inversionAvailable: canInvert,
      inversionCascadeClaimIds,
      inversionCascadeCount,
      articulationToFocus: removalCascadeCount > 0,
      structuralLeverage: Math.max(removalCascadeCount, inversionCascadeCount),
    });
  }

  return {
    focusClaimId: argument.focusClaimId,
    visibleClaimIds: [...visible],
    claims,
    articulationClaimIds: claims
      .filter((claim) => claim.articulationToFocus)
      .map((claim) => claim.claimId),
    removalRanking: [...claims].sort(byRemoval),
    inversionRanking: [...claims].sort(byInversion),
    leverageRanking: [...claims].sort(byLeverage),
  };
}

export function analyzeHornArgumentStreamSensitivity(
  argument: HornArgument,
): HornArgumentStreamSensitivity[] {
  return argument.streams.map((stream) => {
    if (!stream.claimIds.includes(argument.focusClaimId)) {
      return {
        streamId: stream.id,
        title: stream.title ?? stream.id,
        claimCount: stream.claimIds.length,
        analyzable: false,
        articulationClaimIds: [],
        articulationCount: 0,
        maxRemovalCascade: 0,
        maxInversionCascade: 0,
        maxStructuralLeverage: 0,
      };
    }

    const analysis = analyzeHornArgumentSensitivity(argument, stream.claimIds);
    const removal = analysis.removalRanking[0];
    const inversion = analysis.inversionRanking[0];
    const leverage = analysis.leverageRanking[0];
    return {
      streamId: stream.id,
      title: stream.title ?? stream.id,
      claimCount: stream.claimIds.length,
      analyzable: true,
      articulationClaimIds: [...analysis.articulationClaimIds],
      articulationCount: analysis.articulationClaimIds.length,
      maxRemovalCascade: removal?.removalCascadeCount ?? 0,
      maxInversionCascade: inversion?.inversionCascadeCount ?? 0,
      maxStructuralLeverage: leverage?.structuralLeverage ?? 0,
      ...(removal === undefined ? {} : { removalHotspotClaimId: removal.claimId }),
      ...(inversion === undefined ? {} : { inversionHotspotClaimId: inversion.claimId }),
      ...(leverage === undefined ? {} : { leverageHotspotClaimId: leverage.claimId }),
    };
  });
}

/**
 * Ranks streams by structural fragility without inventing a composite score.
 * Removal cascade is primary, then articulation count, then inversion cascade.
 */
export function rankHornArgumentStreamFragility(
  streams: readonly HornArgumentStreamSensitivity[],
): HornArgumentStreamSensitivity[] {
  return [...streams].sort(
    (a, b) =>
      Number(b.analyzable) - Number(a.analyzable) ||
      b.maxRemovalCascade - a.maxRemovalCascade ||
      b.articulationCount - a.articulationCount ||
      b.maxInversionCascade - a.maxInversionCascade ||
      a.streamId.localeCompare(b.streamId),
  );
}
