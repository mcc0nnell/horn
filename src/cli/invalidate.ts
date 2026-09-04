import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  invalidateChangedEvidence,
  type EvidenceBinding,
  type EvidenceSnapshot,
} from "../evidence/invalidation";

const evidencePath = process.argv[2];
const bindingsPath = process.argv[3];
if (!evidencePath || !bindingsPath) {
  throw new Error(
    "Usage: tsx src/cli/invalidate.ts <evidence.json> <bindings.json>",
  );
}

const evidence = JSON.parse(
  readFileSync(resolve(evidencePath), "utf8"),
) as EvidenceSnapshot;
const bindings = JSON.parse(
  readFileSync(resolve(bindingsPath), "utf8"),
) as { bindings: EvidenceBinding[] };

const invalidations = invalidateChangedEvidence(evidence, bindings.bindings);
process.stdout.write(`${JSON.stringify({ stale: invalidations }, null, 2)}\n`);
process.exitCode = invalidations.length > 0 ? 2 : 0;
