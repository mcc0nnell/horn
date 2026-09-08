import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runQuery, stringifyQueryResult, type QueryRequest } from "../analysis/query.js";
import type { HornDocument } from "../types.js";

const [documentPath, queryPath] = process.argv.slice(2);
if (!documentPath || !queryPath) {
  throw new Error("Usage: tsx src/cli/query.ts <document> <query.json>");
}

const source = readFileSync(resolve(documentPath), "utf8");
const querySource = readFileSync(resolve(queryPath), "utf8");
const document = JSON.parse(source) as HornDocument;
const request = JSON.parse(querySource) as QueryRequest;
process.stdout.write(stringifyQueryResult(runQuery(document, request)));
