import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { HornDocument } from "./types";
import { validateHornDocument } from "./validate";
import {
  sortIssues,
  stringifyValidationReport,
  toValidationReport,
} from "./validation-report";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("known-valid fixture produces ok:true and empty issues", () => {
  const path = join(repoRoot, "maps/chinese-room-slice.horn.json");
  const document = JSON.parse(readFileSync(path, "utf8")) as HornDocument;
  const issues = validateHornDocument(document);
  const report = toValidationReport(document, issues);

  assert.equal(report.version, "horn-validation-report/0.1");
  assert.equal(report.documentContract, "horn-document/0.1");
  assert.equal(report.documentId, "horn:authored:2026:chinese-room");
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test("sortIssues orders by code then message", () => {
  const sorted = sortIssues([
    { code: "b", message: "z" },
    { code: "a", message: "m" },
    { code: "a", message: "b" },
  ]);
  assert.deepEqual(sorted, [
    { code: "a", message: "b" },
    { code: "a", message: "m" },
    { code: "b", message: "z" },
  ]);
});

test("stringifyValidationReport is stable 2-space pretty JSON", () => {
  const text = stringifyValidationReport({
    version: "horn-validation-report/0.1",
    documentContract: "horn-document/0.1",
    documentId: "demo",
    ok: false,
    issues: [{ code: "version", message: "Unsupported version x" }],
  });
  assert.equal(
    text,
    `{
  "version": "horn-validation-report/0.1",
  "documentContract": "horn-document/0.1",
  "documentId": "demo",
  "ok": false,
  "issues": [
    {
      "code": "version",
      "message": "Unsupported version x"
    }
  ]
}
`,
  );
});
