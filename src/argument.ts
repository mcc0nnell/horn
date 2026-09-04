export type HornIssueType =
  | "action-or-planning"
  | "terminology"
  | "ethics"
  | "law"
  | "goals"
  | "means"
  | "fact"
  | "explanation";

export type HornClaimRole =
  | "position"
  | "grounds"
  | "warrant"
  | "backing"
  | "rebuttal";

export type HornArgumentRelationKind = "supports" | "disputes" | "backs";

export type HornArgumentSource = {
  id: string;
  citation: string;
  short?: string;
  year?: number;
  url?: string;
  extensions?: Record<string, unknown>;
};

export type HornArgumentClaim = {
  id: string;
  role: HornClaimRole;
  title?: string;
  statement: string;
  sourceIds: string[];
  origin?: "source-explicit" | "source-implied" | "cartographer-authored";
  normalizationNote?: string;
  sourceLocator?: string;
  extensions?: Record<string, unknown>;
};

export type HornArgumentRelation = {
  id: string;
  kind: HornArgumentRelationKind;
  from: string;
  to: string;
  /**
   * For a support move, identifies the warrant that licenses the inference
   * from the grounds/supporting claim to the supported position.
   */
  warrantClaimId?: string;
  label?: string;
  extensions?: Record<string, unknown>;
};

export type HornArgumentStream = {
  id: string;
  title?: string;
  focusClaimId: string;
  claimIds: string[];
  extensions?: Record<string, unknown>;
};

export type HornSubargument = {
  id: string;
  title?: string;
  issueQuestion: string;
  streamIds: string[];
  extensions?: Record<string, unknown>;
};

export type HornArgument = {
  id: string;
  version: "horn-argument/0.1";
  title: string;
  issueQuestion: string;
  issueType: HornIssueType;
  sources: HornArgumentSource[];
  claims: HornArgumentClaim[];
  relations: HornArgumentRelation[];
  focusClaimId: string;
  streams: HornArgumentStream[];
  subarguments?: HornSubargument[];
  extensions?: Record<string, unknown>;
};

export type HornArgumentProblem = {
  code: string;
  message: string;
};

function duplicateIds(items: readonly { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates].sort();
}

export function validateHornArgument(argument: HornArgument): HornArgumentProblem[] {
  const problems: HornArgumentProblem[] = [];

  for (const id of duplicateIds(argument.sources)) {
    problems.push({ code: "duplicate-source-id", message: `duplicate source id: ${id}` });
  }
  for (const id of duplicateIds(argument.claims)) {
    problems.push({ code: "duplicate-claim-id", message: `duplicate claim id: ${id}` });
  }
  for (const id of duplicateIds(argument.relations)) {
    problems.push({ code: "duplicate-relation-id", message: `duplicate relation id: ${id}` });
  }
  for (const id of duplicateIds(argument.streams)) {
    problems.push({ code: "duplicate-stream-id", message: `duplicate stream id: ${id}` });
  }
  for (const id of duplicateIds(argument.subarguments ?? [])) {
    problems.push({ code: "duplicate-subargument-id", message: `duplicate subargument id: ${id}` });
  }

  const sourceIds = new Set(argument.sources.map((source) => source.id));
  const claimById = new Map(argument.claims.map((claim) => [claim.id, claim]));
  const claimIds = new Set(claimById.keys());
  const streamIds = new Set(argument.streams.map((stream) => stream.id));

  if (!claimIds.has(argument.focusClaimId)) {
    problems.push({
      code: "unknown-focus-claim",
      message: `focus claim does not exist: ${argument.focusClaimId}`,
    });
  }

  for (const claim of argument.claims) {
    for (const sourceId of claim.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        problems.push({
          code: "unknown-claim-source",
          message: `claim ${claim.id} references unknown source ${sourceId}`,
        });
      }
    }
  }

  for (const relation of argument.relations) {
    const from = claimById.get(relation.from);
    const to = claimById.get(relation.to);
    if (!from) {
      problems.push({
        code: "unknown-relation-from",
        message: `relation ${relation.id} references unknown from claim ${relation.from}`,
      });
    }
    if (!to) {
      problems.push({
        code: "unknown-relation-to",
        message: `relation ${relation.id} references unknown to claim ${relation.to}`,
      });
    }
    if (relation.from === relation.to) {
      problems.push({
        code: "self-relation",
        message: `relation ${relation.id} cannot relate a claim to itself`,
      });
    }

    if (relation.warrantClaimId !== undefined) {
      if (relation.kind !== "supports") {
        problems.push({
          code: "warrant-on-nonsupport-relation",
          message: `relation ${relation.id} may name a warrant only when kind is supports`,
        });
      }
      const warrant = claimById.get(relation.warrantClaimId);
      if (!warrant) {
        problems.push({
          code: "unknown-warrant-claim",
          message: `relation ${relation.id} references unknown warrant ${relation.warrantClaimId}`,
        });
      } else if (warrant.role !== "warrant") {
        problems.push({
          code: "warrant-role-mismatch",
          message: `relation ${relation.id} names ${relation.warrantClaimId} as a warrant but its role is ${warrant.role}`,
        });
      }
    }

    if (relation.kind === "backs" && from && to) {
      if (from.role !== "backing") {
        problems.push({
          code: "backing-role-mismatch",
          message: `backs relation ${relation.id} must originate at a backing claim`,
        });
      }
      if (to.role !== "warrant") {
        problems.push({
          code: "backing-target-mismatch",
          message: `backs relation ${relation.id} must target a warrant claim`,
        });
      }
    }
  }

  for (const stream of argument.streams) {
    const members = new Set(stream.claimIds);
    if (!claimIds.has(stream.focusClaimId)) {
      problems.push({
        code: "unknown-stream-focus",
        message: `stream ${stream.id} references unknown focus claim ${stream.focusClaimId}`,
      });
    }
    if (!members.has(stream.focusClaimId)) {
      problems.push({
        code: "stream-focus-outside-stream",
        message: `stream ${stream.id} focus claim ${stream.focusClaimId} is not in claimIds`,
      });
    }
    for (const claimId of stream.claimIds) {
      if (!claimIds.has(claimId)) {
        problems.push({
          code: "unknown-stream-claim",
          message: `stream ${stream.id} references unknown claim ${claimId}`,
        });
      }
    }
  }

  for (const subargument of argument.subarguments ?? []) {
    for (const streamId of subargument.streamIds) {
      if (!streamIds.has(streamId)) {
        problems.push({
          code: "unknown-subargument-stream",
          message: `subargument ${subargument.id} references unknown stream ${streamId}`,
        });
      }
    }
  }

  return problems;
}
