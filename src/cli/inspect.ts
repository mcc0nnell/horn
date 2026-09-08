import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { inspectDocument, stringifyInspect, type InspectRequest } from "../analysis/inspect.js";
import { parseProjectionView } from "../analysis/projection.js";
import type { QueryRequest } from "../analysis/query.js";
import type { EvidenceBinding, EvidenceSnapshot } from "../evidence/invalidation.js";
import type { HornDocument } from "../types.js";

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0]?.startsWith("-")) {
  throw new Error(
    "Usage: tsx src/cli/inspect.ts <document> [--projection view]... [--explain-all] [--evidence file] [--bindings file] [--query file]",
  );
}

const documentPath = argv[0] as string;
const request: InspectRequest = { projections: [], queries: [] };

for (let i = 1; i < argv.length; i += 1) {
  const flag = argv[i];
  if (flag === "--projection") {
    const view = argv[i + 1];
    if (!view) {
      throw new Error("--projection requires a view name");
    }
    request.projections = [...(request.projections ?? []), parseProjectionView(view)];
    i += 1;
    continue;
  }
  if (flag === "--explain-all") {
    request.explainAll = true;
    continue;
  }
  if (flag === "--evidence") {
    const path = argv[i + 1];
    if (!path) {
      throw new Error("--evidence requires a file");
    }
    request.evidence = JSON.parse(readFileSync(resolve(path), "utf8")) as EvidenceSnapshot;
    i += 1;
    continue;
  }
  if (flag === "--bindings") {
    const path = argv[i + 1];
    if (!path) {
      throw new Error("--bindings requires a file");
    }
    const parsed = JSON.parse(readFileSync(resolve(path), "utf8")) as {
      bindings: EvidenceBinding[];
    };
    request.bindings = parsed.bindings;
    i += 1;
    continue;
  }
  if (flag === "--query") {
    const path = argv[i + 1];
    if (!path) {
      throw new Error("--query requires a file");
    }
    request.queries = [
      ...(request.queries ?? []),
      JSON.parse(readFileSync(resolve(path), "utf8")) as QueryRequest,
    ];
    i += 1;
    continue;
  }
  throw new Error(`Unknown inspect flag ${flag}`);
}

const sourceText = readFileSync(resolve(documentPath), "utf8");
const document = JSON.parse(sourceText) as HornDocument;
process.stdout.write(stringifyInspect(inspectDocument(document, sourceText, request)));
