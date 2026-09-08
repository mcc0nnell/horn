#!/usr/bin/env node
/**
 * Golden projection compare: TypeScript analytical projection CLI vs native
 * horn_project. Output is renderer-neutral horn-projection/0.1.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const fixturesPath = join(here, "fixtures.txt");
const expectedDir = join(here, "expected");
const generate = process.argv.includes("--generate-expected");
const views = ["argument", "timeline", "evidence", "frontier"];

const hornProject =
  process.env.HORN_PROJECT?.trim() ||
  join(repoRoot, "build/native/horn_project");

function fixtureSlug(fixturePath) {
  return basename(fixturePath).replace(/\.horn\.json$/, "");
}

function loadFixtures() {
  return readFileSync(fixturesPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

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
    maxBuffer: 16 * 1024 * 1024,
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

function runTs(fixtureRel, view) {
  return runCapture(
    process.execPath,
    [
      join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
      join(repoRoot, "src/cli/project.ts"),
      fixtureRel,
      view,
    ],
    `TypeScript project (${fixtureRel} ${view})`,
  );
}

function runNative(fixtureRel, view) {
  if (!existsSync(hornProject)) {
    throw new Error(
      `Native horn_project binary not found at ${hornProject}. ` +
        `Build with: cmake -S native -B build/native && cmake --build build/native --target horn_project ` +
        `(or set HORN_PROJECT).`,
    );
  }
  return runCapture(
    hornProject,
    [join(repoRoot, fixtureRel), view],
    `Native horn_project (${fixtureRel} ${view})`,
  );
}

mkdirSync(expectedDir, { recursive: true });
const fixtures = loadFixtures();
let failures = 0;
let compared = 0;

for (const fixtureRel of fixtures) {
  for (const view of views) {
    const expectedPath = join(expectedDir, `${fixtureSlug(fixtureRel)}.${view}.json`);
    const tsOut = runTs(fixtureRel, view);
    const tsCanon = canonicalizeJsonText(tsOut);
    compared += 1;

    if (generate) {
      writeFileSync(expectedPath, tsOut);
      console.log(`wrote expected ${expectedPath}`);
      continue;
    }

    if (!existsSync(expectedPath)) {
      console.error(`Missing expected ${expectedPath}`);
      failures += 1;
      continue;
    }

    const expectedCanon = canonicalizeJsonText(readFileSync(expectedPath, "utf8"));
    if (tsCanon !== expectedCanon) {
      console.error(`TS projection mismatch for ${fixtureRel} ${view}`);
      failures += 1;
    } else {
      console.log(`ok ts  ${fixtureRel} ${view}`);
    }

    try {
      const nativeOut = runNative(fixtureRel, view);
      const nativeCanon = canonicalizeJsonText(nativeOut);
      if (nativeCanon !== expectedCanon) {
        console.error(`Native projection mismatch for ${fixtureRel} ${view}`);
        failures += 1;
      } else if (nativeOut !== tsOut) {
        console.error(`Native/TS pretty mismatch for ${fixtureRel} ${view}`);
        failures += 1;
      } else {
        console.log(`ok cxx ${fixtureRel} ${view}`);
      }
    } catch (error) {
      console.error(String(error instanceof Error ? error.message : error));
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(`golden:projection failed (${failures} mismatch(es))`);
  process.exit(1);
}

console.log(
  generate
    ? `Generated ${compared} expected projection(s).`
    : `All ${compared} projection(s) matched.`,
);
