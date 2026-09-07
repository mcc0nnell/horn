import type { HornArgument } from "./argument";

export type HornExtractionSourceRef = {
  id: string;
  locator?: string;
  digest?: string;
  extensions?: Record<string, unknown>;
};

export type HornExtractionSpan = {
  id: string;
  sourceId: string;
  locator: string;
  text: string;
  extensions?: Record<string, unknown>;
};

export type HornCandidateClaim = {
  id: string;
  spanIds: string[];
  statement: string;
  origin?: "explicit" | "implied";
  notes?: string;
  extensions?: Record<string, unknown>;
};

export type HornSelectionDecision = {
  candidateId: string;
  decision: "select" | "reject" | "merge";
  reason: string;
  mergeWithCandidateIds?: string[];
  claimId?: string;
  normalizedStatement?: string;
  normalizationNote?: string;
  extensions?: Record<string, unknown>;
};

export type HornExtraction = {
  id: string;
  version: "horn-extraction/0.1";
  argumentId: string;
  sources: HornExtractionSourceRef[];
  spans: HornExtractionSpan[];
  candidates: HornCandidateClaim[];
  decisions: HornSelectionDecision[];
  extensions?: Record<string, unknown>;
};

export type HornExtractionProblem = {
  code: string;
  message: string;
};

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

/**
 * Validate the auditable seam from source reading to normalized Horn argument.
 *
 * This does not decide whether a cartographer made a good editorial judgment.
 * It guarantees that every judgment has inspectable inputs and that every
 * selected/merged output resolves to the semantic argument it claims to create.
 */
export function validateHornExtraction(
  extraction: HornExtraction,
  argument: HornArgument,
): HornExtractionProblem[] {
  const problems: HornExtractionProblem[] = [];

  for (const id of duplicates(extraction.sources.map((source) => source.id))) {
    problems.push({ code: "duplicate-extraction-source", message: `duplicate extraction source: ${id}` });
  }
  for (const id of duplicates(extraction.spans.map((span) => span.id))) {
    problems.push({ code: "duplicate-span", message: `duplicate source span: ${id}` });
  }
  for (const id of duplicates(extraction.candidates.map((candidate) => candidate.id))) {
    problems.push({ code: "duplicate-candidate", message: `duplicate candidate claim: ${id}` });
  }
  for (const id of duplicates(extraction.decisions.map((decision) => decision.candidateId))) {
    problems.push({ code: "duplicate-decision", message: `candidate has multiple decisions: ${id}` });
  }

  if (extraction.argumentId !== argument.id) {
    problems.push({
      code: "argument-id-mismatch",
      message: `extraction targets ${extraction.argumentId}, but argument is ${argument.id}`,
    });
  }

  const sourceIds = new Set(extraction.sources.map((source) => source.id));
  const argumentSourceIds = new Set(argument.sources.map((source) => source.id));
  const spanIds = new Set(extraction.spans.map((span) => span.id));
  const candidateById = new Map(extraction.candidates.map((candidate) => [candidate.id, candidate]));
  const claimById = new Map(argument.claims.map((claim) => [claim.id, claim]));

  for (const sourceId of sourceIds) {
    if (!argumentSourceIds.has(sourceId)) {
      problems.push({
        code: "extraction-source-not-in-argument",
        message: `extraction source ${sourceId} is not declared by argument ${argument.id}`,
      });
    }
  }

  for (const span of extraction.spans) {
    if (!sourceIds.has(span.sourceId)) {
      problems.push({
        code: "unknown-span-source",
        message: `span ${span.id} references unknown extraction source ${span.sourceId}`,
      });
    }
  }

  for (const candidate of extraction.candidates) {
    for (const spanId of candidate.spanIds) {
      if (!spanIds.has(spanId)) {
        problems.push({
          code: "unknown-candidate-span",
          message: `candidate ${candidate.id} references unknown span ${spanId}`,
        });
      }
    }
  }

  const decisions = new Map(extraction.decisions.map((decision) => [decision.candidateId, decision]));
  for (const candidate of extraction.candidates) {
    if (!decisions.has(candidate.id)) {
      problems.push({
        code: "candidate-without-decision",
        message: `candidate ${candidate.id} has no selection decision`,
      });
    }
  }

  for (const decision of extraction.decisions) {
    if (!candidateById.has(decision.candidateId)) {
      problems.push({
        code: "decision-for-unknown-candidate",
        message: `decision references unknown candidate ${decision.candidateId}`,
      });
      continue;
    }

    if (decision.decision === "merge") {
      if (!decision.mergeWithCandidateIds?.length) {
        problems.push({
          code: "merge-without-candidates",
          message: `merge decision for ${decision.candidateId} names no merge candidates`,
        });
      }
      for (const otherId of decision.mergeWithCandidateIds ?? []) {
        if (!candidateById.has(otherId)) {
          problems.push({
            code: "unknown-merge-candidate",
            message: `merge decision for ${decision.candidateId} references unknown candidate ${otherId}`,
          });
        }
      }
    }

    if (decision.decision === "select" || decision.decision === "merge") {
      if (!decision.claimId || !decision.normalizedStatement) {
        problems.push({
          code: "selected-decision-without-output",
          message: `decision for ${decision.candidateId} must name a claim and normalized statement`,
        });
        continue;
      }
      const claim = claimById.get(decision.claimId);
      if (!claim) {
        problems.push({
          code: "decision-output-claim-missing",
          message: `decision for ${decision.candidateId} produces unknown claim ${decision.claimId}`,
        });
        continue;
      }
      if (claim.statement !== decision.normalizedStatement) {
        problems.push({
          code: "normalized-statement-mismatch",
          message: `decision for ${decision.candidateId} does not match argument claim ${decision.claimId}`,
        });
      }
    }
  }

  return problems;
}
