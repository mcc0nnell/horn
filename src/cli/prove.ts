import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createHornQueryProof } from "../proof";
import type { HornDocument } from "../types";

const [documentPath, requestPath] = process.argv.slice(2);
if (!documentPath || !requestPath) {
  throw new Error(
    "Usage: tsx src/cli/prove.ts <map.horn.json> <horn-query-request.json>",
  );
}

const document = JSON.parse(
  readFileSync(resolve(documentPath), "utf8"),
) as HornDocument;
const request = JSON.parse(readFileSync(resolve(requestPath), "utf8")) as unknown;

process.stdout.write(`${JSON.stringify(createHornQueryProof(document, request), null, 2)}\n`);
