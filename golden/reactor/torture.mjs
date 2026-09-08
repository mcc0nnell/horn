#!/usr/bin/env node
/**
 * Seeded differential torture harness. Prints the seed. Compares TypeScript
 * and native validation / projection / query / invalidation / diff.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const seed = Number(process.env.HORN_TORTURE_SEED ?? 845);
const outDir = join(here, "generated");
const nativeDir = process.env.HORN_NATIVE_BIN?.trim() || join(repoRoot, "build/native");
const skipNative = process.argv.includes("--ts-only") || !existsSync(join(nativeDir, "horn_validate"));

console.log(`horn torture seed ${seed}`);

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

function canonicalizeJsonText(text) {
  return JSON.stringify(sortKeys(JSON.parse(text)));
}

function runCapture(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`${label} exited ${result.status}${err ? `: ${err}` : ""}`);
  }
  return result.stdout;
}

function tsx(script, args, label) {
  return runCapture(
    process.execPath,
    [join(repoRoot, "node_modules/tsx/dist/cli.mjs"), join(repoRoot, script), ...args],
    label,
  );
}

function native(binary, args, label) {
  return runCapture(join(nativeDir, binary), args, label);
}

const listed = runCapture(
  process.execPath,
  [
    join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
    join(here, "write-generated.ts"),
    String(seed),
    outDir,
  ],
  "generate fixtures",
);
console.log(listed.trim());

mkdirSync(outDir, { recursive: true });
const cases = JSON.parse(
  runCapture(
    process.execPath,
    [
      join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
      join(here, "list-generated.ts"),
      String(seed),
      outDir,
    ],
    "list fixtures",
  ),
);

let failures = 0;
const views = ["argument", "timeline", "evidence", "frontier"];

for (const item of cases) {
  const docPath = item.path;
  const label = item.name;
  const tsReport = tsx("src/cli/validate-report.ts", [docPath], `validate ${label}`);
  if (!skipNative) {
    try {
      const cxxReport = native("horn_validate", [docPath], `validate native ${label}`);
      if (canonicalizeJsonText(tsReport) !== canonicalizeJsonText(cxxReport)) {
        console.error(`validation mismatch ${label}`);
        failures += 1;
      }
    } catch (error) {
      console.error(String(error instanceof Error ? error.message : error));
      failures += 1;
    }
  }

  for (const view of views) {
    const tsProj = tsx("src/cli/project.ts", [docPath, view], `project ${label} ${view}`);
    if (!skipNative) {
      try {
        const cxxProj = native("horn_project", [docPath, view], `project native ${label} ${view}`);
        if (canonicalizeJsonText(tsProj) !== canonicalizeJsonText(cxxProj)) {
          console.error(`projection mismatch ${label} ${view}`);
          failures += 1;
        }
      } catch (error) {
        console.error(String(error instanceof Error ? error.message : error));
        failures += 1;
      }
    }
  }

  const firstNode = item.firstNode;
  if (firstNode) {
    const query = { version: "horn-query/0.1", op: "neighborhood", id: firstNode };
    const queryPath = join(outDir, `${label}.neighborhood.json`);
    writeFileSync(queryPath, `${JSON.stringify(query, null, 2)}\n`);
    const tsQuery = tsx("src/cli/query.ts", [docPath, queryPath], `query ${label}`);
    if (!skipNative) {
      try {
        const cxxQuery = native("horn_query", [docPath, queryPath], `query native ${label}`);
        if (canonicalizeJsonText(tsQuery) !== canonicalizeJsonText(cxxQuery)) {
          console.error(`query mismatch ${label}`);
          failures += 1;
        }
      } catch (error) {
        console.error(String(error instanceof Error ? error.message : error));
        failures += 1;
      }
    }
  }

  const staleQuery = {
    version: "horn-query/0.1",
    op: "node-lookup",
    id: "missing-stale-identity",
  };
  const stalePath = join(outDir, `${label}.stale.json`);
  writeFileSync(stalePath, `${JSON.stringify(staleQuery, null, 2)}\n`);
  const tsStale = tsx("src/cli/query.ts", [docPath, stalePath], `stale ${label}`);
  if (!skipNative) {
    try {
      const cxxStale = native("horn_query", [docPath, stalePath], `stale native ${label}`);
      if (canonicalizeJsonText(tsStale) !== canonicalizeJsonText(cxxStale)) {
        console.error(`stale-identity mismatch ${label}`);
        failures += 1;
      }
    } catch (error) {
      console.error(String(error instanceof Error ? error.message : error));
      failures += 1;
    }
  }

  const tsDiff = tsx("src/cli/diff.ts", [docPath, docPath], `diff ${label}`);
  if (!skipNative) {
    try {
      const cxxDiff = native("horn_diff", [docPath, docPath], `diff native ${label}`);
      if (canonicalizeJsonText(tsDiff) !== canonicalizeJsonText(cxxDiff)) {
        console.error(`diff mismatch ${label}`);
        failures += 1;
      }
    } catch (error) {
      console.error(String(error instanceof Error ? error.message : error));
      failures += 1;
    }
  }
  console.log(`ok case ${label}`);
}

if (failures > 0) {
  console.error(`golden:torture failed (${failures} mismatch(es)) seed ${seed}`);
  process.exit(1);
}
console.log(`All torture cases matched for seed ${seed}${skipNative ? " (TypeScript only)" : ""}.`);
