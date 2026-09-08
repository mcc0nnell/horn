export const RUNTIME_API_VERSION = "horn-runtime/0.1" as const;
export const DOCUMENT_CONTRACT = "horn-document/0.1" as const;
export const PROJECTION_CONTRACT = "horn-projection/0.1" as const;
export const QUERY_CONTRACT = "horn-query/0.1" as const;
export const QUERY_RESULT_CONTRACT = "horn-query-result/0.1" as const;
export const EXPLANATION_CONTRACT = "horn-explanation/0.1" as const;
export const IMPACT_CONTRACT = "horn-impact-report/0.1" as const;
export const DIFF_CONTRACT = "horn-diff/0.1" as const;
export const INSPECT_CONTRACT = "horn-inspect/0.1" as const;
export const ANALYSIS_EXTENSION = "x-analysis" as const;
export const ANALYSIS_CONTRACT = "horn-analysis/0.1" as const;

export const DIALECTICAL_RELATION_KINDS = [
  "supports",
  "disputes",
  "interprets-as",
] as const;

export const SUPPORT_RELATION_KINDS = ["supports"] as const;
export const CHALLENGE_RELATION_KINDS = ["disputes"] as const;

export const PROJECTION_VIEWS = [
  "argument",
  "timeline",
  "evidence",
  "frontier",
] as const;

export type ProjectionView = (typeof PROJECTION_VIEWS)[number];

export const PROJECTION_TITLES: Record<ProjectionView, string> = {
  argument: "Argument",
  timeline: "Timeline",
  evidence: "Evidence",
  frontier: "Frontier",
};

export const PROJECTION_DESCRIPTIONS: Record<ProjectionView, string> = {
  argument:
    "Semantic response topology; relation routes are intentionally abstracted.",
  timeline:
    "Chronological projection of dated claims without changing the Horn document.",
  evidence:
    "Derived source-to-claim network across mapped and cartographic provenance layers.",
  frontier:
    "Reader-facing dialogue threads from focus boxes to their current terminal arguments.",
};
