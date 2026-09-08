import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { analyzeHornEvidenceImpactArtifacts } from "../evidence/artifact-impact";
import type { HornDocument } from "../types";

const [documentPath, evidencePath, bindingsPath, requestPath] = process.argv.slice(2);
if (!documentPath || !evidencePath || !bindingsPath || !requestPath) {
  throw new Error(
    "Usage: tsx src/cli/evidence-impact-artifact.ts <map.horn.json> <horn-evidence-snapshot.json> <horn-evidence-bindings.json> <horn-evidence-impact-request.json>",
  );
}

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

const document = readJson(documentPath) as HornDocument;
const report = analyzeHornEvidenceImpactArtifacts(
  document,
  readJson(evidencePath),
  readJson(bindingsPath),
  readJson(requestPath),
);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
