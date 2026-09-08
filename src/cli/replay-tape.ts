import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { verifyHornTape, type HornTape } from "../tape";
import type { HornDocument } from "../types";

const [documentPath, tapePath] = process.argv.slice(2);
if (!documentPath || !tapePath) {
  throw new Error(
    "Usage: tsx src/cli/replay-tape.ts <map.horn.json> <horn-tape.json>",
  );
}

const document = JSON.parse(
  readFileSync(resolve(documentPath), "utf8"),
) as HornDocument;
const tape = JSON.parse(readFileSync(resolve(tapePath), "utf8")) as HornTape;
const report = verifyHornTape(document, tape);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.valid ? 0 : 1;
