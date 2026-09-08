import type { HornDocument } from "./types";
import type { HornIssue } from "./validate";

export const VALIDATION_REPORT_VERSION = "horn-validation-report/0.1" as const;
export const DOCUMENT_CONTRACT = "horn-document/0.1" as const;

export type HornValidationReport = {
  version: typeof VALIDATION_REPORT_VERSION;
  documentContract: typeof DOCUMENT_CONTRACT;
  documentId: string;
  ok: boolean;
  issues: HornIssue[];
};

/** Sort issues by (code, message) for deterministic compare. */
export function sortIssues(issues: readonly HornIssue[]): HornIssue[] {
  return [...issues].sort((a, b) => {
    const byCode = a.code.localeCompare(b.code);
    if (byCode !== 0) {
      return byCode;
    }
    return a.message.localeCompare(b.message);
  });
}

/**
 * Build a normalized horn-validation-report/0.1 from a document and its issues.
 * Issues are sorted by (code, message). Key insertion order is stable for JSON.
 */
export function toValidationReport(
  doc: Pick<HornDocument, "id">,
  issues: readonly HornIssue[],
): HornValidationReport {
  const sorted = sortIssues(issues);
  return {
    version: VALIDATION_REPORT_VERSION,
    documentContract: DOCUMENT_CONTRACT,
    documentId: doc.id,
    ok: sorted.length === 0,
    issues: sorted,
  };
}

/** Deterministic 2-space pretty JSON with stable issue order. */
export function stringifyValidationReport(report: HornValidationReport): string {
  const ordered = {
    version: report.version,
    documentContract: report.documentContract,
    documentId: report.documentId,
    ok: report.ok,
    issues: report.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
    })),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
