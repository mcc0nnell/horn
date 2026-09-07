import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { traceHornNode } from "../trace";
import type { HornDocument } from "../types";

const [input, nodeId] = process.argv.slice(2);
if (!input || !nodeId) {
  throw new Error("Usage: tsx src/cli/trace.ts <map.horn.json> <node-id>");
}

const source = readFileSync(resolve(input), "utf8");
const document = JSON.parse(source) as HornDocument;
const trace = traceHornNode(document, nodeId);

process.stdout.write(`${JSON.stringify(trace, null, 2)}\n`);
