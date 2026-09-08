import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { diffHornDocuments, stringifyDiff } from "../analysis/diff.js";
import type { HornDocument } from "../types.js";

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  throw new Error("Usage: tsx src/cli/diff.ts <before.horn.json> <after.horn.json>");
}

const before = JSON.parse(readFileSync(resolve(beforePath), "utf8")) as HornDocument;
const after = JSON.parse(readFileSync(resolve(afterPath), "utf8")) as HornDocument;
process.stdout.write(stringifyDiff(diffHornDocuments(before, after)));
