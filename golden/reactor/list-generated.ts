import { join, resolve } from "node:path";

import { generateFixtureCases } from "../../src/analysis/generator.ts";

const seed = Number(process.argv[2] ?? 845);
const outDir = resolve(process.argv[3] ?? "golden/reactor/generated");
const cases = generateFixtureCases(seed).map((item) => ({
  name: item.name,
  validIntent: item.validIntent,
  path: join(outDir, `${item.name}.horn.json`),
  firstNode: item.document.nodes[0]?.id ?? null,
}));
process.stdout.write(`${JSON.stringify(cases)}\n`);
