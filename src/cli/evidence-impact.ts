import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { analyzeHornEvidenceImpact } from "../evidence/impact";
import type {
  EvidenceBinding,
  EvidenceSnapshot,
} from "../evidence/invalidation";
import type { HornQueryRequest } from "../query";
import type { HornDocument } from "../types";

const [documentPath, evidencePath, bindingsPath, requestsPath] = process.argv.slice(2);
if (!documentPath || !evidencePath || !bindingsPath || !requestsPath) {
  throw new Error(
    "Usage: tsx src/cli/evidence-impact.ts <map.horn.json> <evidence.json> <bindings.json> <query-requests.json>",
  );
}

const document = JSON.parse(
  readFileSync(resolve(documentPath), "utf8"),
) as HornDocument;
const evidence = JSON.parse(
  readFileSync(resolve(evidencePath), "utf8"),
) as EvidenceSnapshot;
const bindings = JSON.parse(
  readFileSync(resolve(bindingsPath), "utf8"),
) as EvidenceBinding[];
const requests = JSON.parse(
  readFileSync(resolve(requestsPath), "utf8"),
) as HornQueryRequest[];

if (!Array.isArray(bindings) || !Array.isArray(requests)) {
  throw new Error("bindings and query requests must be JSON arrays");
}

const report = analyzeHornEvidenceImpact(document, evidence, bindings, requests);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
