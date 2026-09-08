import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { verifyHornQueryProof } from "../proof";
import type { HornDocument } from "../types";

const [documentPath, proofPath] = process.argv.slice(2);
if (!documentPath || !proofPath) {
  throw new Error(
    "Usage: tsx src/cli/verify-proof.ts <map.horn.json> <horn-proof.json>",
  );
}

const document = JSON.parse(
  readFileSync(resolve(documentPath), "utf8"),
) as HornDocument;
const proof = JSON.parse(readFileSync(resolve(proofPath), "utf8")) as unknown;
const report = verifyHornQueryProof(document, proof);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.ok ? 0 : 1;
