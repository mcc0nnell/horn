import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { explainIdentity, stringifyExplanation, type ExplanationSupport } from "../analysis/explain.js";
import type { HornArgument } from "../argument.js";
import type { EvidenceBinding, EvidenceSnapshot } from "../evidence/invalidation.js";
import type { HornExtraction } from "../extraction.js";
import type { HornDocument } from "../types.js";

const [documentPath, identity, ...supportPaths] = process.argv.slice(2);
if (!documentPath || !identity) {
  throw new Error(
    "Usage: tsx src/cli/explain.ts <document> <identity> [supporting artifacts...]",
  );
}

function loadSupport(path: string, support: ExplanationSupport): void {
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8")) as Record<string, unknown>;
  if (parsed.version === "horn-argument/0.1") {
    support.argument = parsed as unknown as HornArgument;
    return;
  }
  if (parsed.version === "horn-extraction/0.1") {
    support.extraction = parsed as unknown as HornExtraction;
    return;
  }
  if (parsed.components && parsed.dependencyGraph) {
    support.evidence = parsed as unknown as EvidenceSnapshot;
    return;
  }
  if (Array.isArray(parsed.bindings)) {
    support.bindings = parsed.bindings as EvidenceBinding[];
  }
}

const source = readFileSync(resolve(documentPath), "utf8");
const document = JSON.parse(source) as HornDocument;
const support: ExplanationSupport = {};
for (const path of supportPaths) {
  loadSupport(path, support);
}
process.stdout.write(stringifyExplanation(explainIdentity(document, identity, support)));
