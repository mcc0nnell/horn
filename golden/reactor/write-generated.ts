import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { generateFixtureCases } from "../../src/analysis/generator.ts";
import { stringifyNormalized } from "../../src/analysis/canonical.ts";

const seed = Number(process.argv[2] ?? 845);
const outDir = resolve(process.argv[3] ?? "golden/reactor/generated");
mkdirSync(outDir, { recursive: true });
const cases = generateFixtureCases(seed);
for (const item of cases) {
  const path = join(outDir, `${item.name}.horn.json`);
  writeFileSync(path, stringifyNormalized(item.document));
}
process.stdout.write(`wrote ${cases.length} fixtures to ${outDir}\n`);
