import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { HornDocument } from "../types";
import { validateHornDocument } from "../validate";
import {
  stringifyValidationReport,
  toValidationReport,
} from "../validation-report";

const input = process.argv[2];
if (!input) {
  throw new Error("Usage: tsx src/cli/validate-report.ts <map.horn.json>");
}

const source = readFileSync(resolve(input), "utf8");
const document = JSON.parse(source) as HornDocument;
const issues = validateHornDocument(document);
const report = toValidationReport(document, issues);
process.stdout.write(stringifyValidationReport(report));
