import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { recordHornTape, type HornTapePlan } from "../tape";
import type { HornDocument } from "../types";

const [documentPath, planPath] = process.argv.slice(2);
if (!documentPath || !planPath) {
  throw new Error(
    "Usage: tsx src/cli/tape.ts <map.horn.json> <horn-tape-plan.json>",
  );
}

const document = JSON.parse(
  readFileSync(resolve(documentPath), "utf8"),
) as HornDocument;
const plan = JSON.parse(
  readFileSync(resolve(planPath), "utf8"),
) as HornTapePlan;

process.stdout.write(`${JSON.stringify(recordHornTape(document, plan), null, 2)}\n`);
