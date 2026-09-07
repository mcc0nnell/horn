import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderHornSvg } from "../render";
import type { HornDocument } from "../types";

const input = process.argv[2];
if (!input) {
  throw new Error("Usage: tsx src/cli/render.ts <map.horn.json>");
}

const source = readFileSync(resolve(input), "utf8");
const document = JSON.parse(source) as HornDocument;
const result = renderHornSvg(document);

for (const warning of result.warnings) {
  console.error(`${warning.code}: ${warning.message}`);
}

process.stdout.write(result.svg);
