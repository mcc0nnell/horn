#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const document = join(here, "reactor-diamond.horn.json");
const cases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const hornQuery = process.env.HORN_QUERY?.trim() || join(repoRoot, "build/native/horn_query");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function canon(text) { return stable(JSON.parse(text)); }
function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${label} exited ${result.status}: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout;
}

if (!existsSync(hornQuery)) {
  throw new Error(
    `Native horn_query not found at ${hornQuery}. ` +
    `Build with: cmake -S native -B build/native && cmake --build build/native --target horn_query_cli ` +
    `(or set HORN_QUERY).`,
  );
}

const temp = mkdtempSync(join(tmpdir(), "horn-query-golden-"));
let failures = 0;
try {
  for (const testCase of cases) {
    const requestPath = join(temp, `${testCase.name}.request.json`);
    writeFileSync(requestPath, `${JSON.stringify(testCase.request, null, 2)}\n`);
    const expected = stable(testCase.expected);

    const ts = canon(run(
      process.execPath,
      [
        join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
        join(repoRoot, "src/cli/query.ts"),
        document,
        requestPath,
      ],
      `TypeScript query ${testCase.name}`,
    ));

    const native = canon(run(
      hornQuery,
      [document, requestPath],
      `native query ${testCase.name}`,
    ));

    if (ts !== expected) {
      console.error(`TS mismatch: ${testCase.name}`);
      failures += 1;
    } else {
      console.log(`ok ts  ${testCase.name}`);
    }

    if (native !== expected) {
      console.error(`C++ mismatch: ${testCase.name}`);
      failures += 1;
    } else {
      console.log(`ok cxx ${testCase.name}`);
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`golden:query failed (${failures} mismatch(es))`);
  process.exit(1);
}

console.log(`All ${cases.length} Horn query cases matched TypeScript, C++, and expected artifacts.`);
