#!/usr/bin/env node
/**
 * Golden validation compare: TypeScript report CLI vs native horn_validate
 * against checked-in expected reports.
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

const hornValidate =
  process.env.HORN_VALIDATE?.trim() ||
  join(repoRoot, "build/native/horn_validate");

function fixtureSlug(fixturePath) {
  return basename(fixturePath).replace(/\.horn\.json$/, "");
}

function loadFixtures() {
  return readFileSync(fixturesPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalizeJsonText(text) {
  return stableStringify(JSON.parse(text));
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
    throw new Error(
      `${label} exited ${result.status}${err ? `: ${err}` : ""}`,
    );
  }
  return result.stdout;
}

function runTsReport(fixtureRel) {
  return runCapture(
    process.execPath,
    [
      join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
      join(repoRoot, "src/cli/validate-report.ts"),
      fixtureRel,
    ],
    `TypeScript validate-report (${fixtureRel})`,
  );
}

function runNativeReport(fixtureRel) {
  if (!existsSync(hornValidate)) {
    throw new Error(
      `Native horn_validate binary not found at ${hornValidate}. ` +
        `Build with: cmake -S native -B build/native && cmake --build build/native --target horn_validate ` +
        `(or set HORN_VALIDATE to the binary path).`,
    );
  }
  return runCapture(
    hornValidate,
    [join(repoRoot, fixtureRel)],
    `Native horn_validate (${fixtureRel})`,
  );
}

mkdirSync(expectedDir, { recursive: true });
const fixtures = loadFixtures();
let failures = 0;

for (const fixtureRel of fixtures) {
  const slug = fixtureSlug(fixtureRel);
  const expectedPath = join(expectedDir, `${slug}.json`);
  const tsOut = runTsReport(fixtureRel);
  const tsCanon = canonicalizeJsonText(tsOut);

  if (generate) {
    writeFileSync(expectedPath, tsOut);
    console.log(`wrote expected ${expectedPath}`);
  }

  if (!existsSync(expectedPath)) {
    console.error(
      `Missing expected report ${expectedPath}. Run: node golden/validation/compare.mjs --generate-expected`,
    );
    failures += 1;
    continue;
  }

  const expectedCanon = canonicalizeJsonText(
    readFileSync(expectedPath, "utf8"),
  );
  if (tsCanon !== expectedCanon) {
    console.error(`TS report mismatch for ${fixtureRel} vs ${expectedPath}`);
    failures += 1;
  } else {
    console.log(`ok ts  ${fixtureRel}`);
  }

  if (generate) {
    continue;
  }

  try {
    const nativeOut = runNativeReport(fixtureRel);
    const nativeCanon = canonicalizeJsonText(nativeOut);
    if (nativeCanon !== expectedCanon) {
      console.error(
        `Native report mismatch for ${fixtureRel} vs ${expectedPath}`,
      );
      console.error("--- expected (canonical) ---");
      console.error(expectedCanon);
      console.error("--- native (canonical) ---");
      console.error(nativeCanon);
      failures += 1;
    } else {
      console.log(`ok cxx ${fixtureRel}`);
    }
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`golden:validation failed (${failures} mismatch(es))`);
  process.exit(1);
}

console.log(
  generate
    ? `Generated ${fixtures.length} expected report(s).`
    : `All ${fixtures.length} fixture(s) matched.`,
);
