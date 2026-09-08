import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assessEvidenceImpact, stringifyImpact } from "../analysis/impact.js";
import type { EvidenceBinding, EvidenceSnapshot } from "../evidence/invalidation.js";
import type { HornDocument } from "../types.js";

const [documentPath, evidencePath, bindingsPath] = process.argv.slice(2);
if (!documentPath || !evidencePath || !bindingsPath) {
  throw new Error(
    "Usage: tsx src/cli/impact.ts <document> <evidence> <bindings>",
  );
}

const document = JSON.parse(readFileSync(resolve(documentPath), "utf8")) as HornDocument;
const evidence = JSON.parse(
  readFileSync(resolve(evidencePath), "utf8"),
) as EvidenceSnapshot;
const bindingsFile = JSON.parse(readFileSync(resolve(bindingsPath), "utf8")) as {
  bindings: EvidenceBinding[];
};
process.stdout.write(
  stringifyImpact(assessEvidenceImpact(document, evidence, bindingsFile.bindings)),
);
