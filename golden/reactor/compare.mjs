#!/usr/bin/env node
/**
 * Golden reactor compare: TypeScript analysis CLIs vs native horn_* binaries.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const expectedDir = join(here, "expected");
const generate = process.argv.includes("--generate-expected");
const nativeDir = process.env.HORN_NATIVE_BIN?.trim() || join(repoRoot, "build/native");

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
  const path = join(nativeDir, binary);
  if (!existsSync(path)) {
    throw new Error(
      `Native ${binary} not found at ${path}. Build libhorn or set HORN_NATIVE_BIN.`,
    );
  }
  return runCapture(path, args, label);
}

function compareCase(name, tsOut, nativeFn) {
  const expectedPath = join(expectedDir, `${name}.json`);
  const tsCanon = canonicalizeJsonText(tsOut);
  if (generate) {
    writeFileSync(expectedPath, tsOut);
    console.log(`wrote expected ${expectedPath}`);
    return 0;
  }
  if (!existsSync(expectedPath)) {
    console.error(`Missing expected ${expectedPath}`);
    return 1;
  }
  const expectedCanon = canonicalizeJsonText(readFileSync(expectedPath, "utf8"));
  let failures = 0;
  if (tsCanon !== expectedCanon) {
    console.error(`TS mismatch ${name}`);
    failures += 1;
  } else {
    console.log(`ok ts  ${name}`);
  }
  try {
    const nativeOut = nativeFn();
    const nativeCanon = canonicalizeJsonText(nativeOut);
    if (nativeCanon !== expectedCanon) {
      console.error(`Native mismatch ${name}`);
      failures += 1;
    } else if (nativeOut !== tsOut) {
      console.error(`Native/TS pretty mismatch ${name}`);
      failures += 1;
    } else {
      console.log(`ok cxx ${name}`);
    }
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    failures += 1;
  }
  return failures;
}

mkdirSync(expectedDir, { recursive: true });
let failures = 0;

const chinese = "maps/chinese-room-slice.horn.json";
const celix = "maps/celix-845-specimen-001.horn.json";
const evidence = "experiments/celix-845/evidence/sbom-physical-evidence.json";
const bindings = "experiments/celix-845/evidence/bindings.json";
const argument = "arguments/chinese-room.horn-argument.json";

for (const file of readdirSync(join(here, "queries")).sort()) {
  if (!file.endsWith(".json")) {
    continue;
  }
  const queryRel = join("golden/reactor/queries", file);
  const name = `query-${basename(file, ".json")}`;
  const tsOut = tsx("src/cli/query.ts", [chinese, queryRel], name);
  failures += compareCase(name, tsOut, () =>
    native("horn_query", [join(repoRoot, chinese), join(repoRoot, queryRel)], name),
  );
}

failures += compareCase(
  "explain-c1",
  tsx("src/cli/explain.ts", [chinese, "c1-machines-can-think", argument], "explain-c1"),
  () =>
    native(
      "horn_explain",
      [join(repoRoot, chinese), "c1-machines-can-think", join(repoRoot, argument)],
      "explain-c1",
    ),
);

failures += compareCase(
  "impact-celix",
  tsx("src/cli/impact.ts", [celix, evidence, bindings], "impact-celix"),
  () =>
    native(
      "horn_impact",
      [join(repoRoot, celix), join(repoRoot, evidence), join(repoRoot, bindings)],
      "impact-celix",
    ),
);

failures += compareCase(
  "diff-identity",
  tsx("src/cli/diff.ts", [chinese, chinese], "diff-identity"),
  () =>
    native(
      "horn_diff",
      [join(repoRoot, chinese), join(repoRoot, chinese)],
      "diff-identity",
    ),
);

failures += compareCase(
  "inspect-chinese-room",
  tsx(
    "src/cli/inspect.ts",
    [
      chinese,
      "--projection",
      "argument",
      "--projection",
      "timeline",
      "--projection",
      "evidence",
      "--projection",
      "frontier",
      "--query",
      "golden/reactor/queries/frontier.json",
    ],
    "inspect-chinese-room",
  ),
  () =>
    native(
      "horn_inspect",
      [
        join(repoRoot, chinese),
        "--projection",
        "argument",
        "--projection",
        "timeline",
        "--projection",
        "evidence",
        "--projection",
        "frontier",
        "--query",
        join(repoRoot, "golden/reactor/queries/frontier.json"),
      ],
      "inspect-chinese-room",
    ),
);

if (failures > 0) {
  console.error(`golden:reactor failed (${failures} mismatch(es))`);
  process.exit(1);
}

console.log(generate ? "Generated reactor expected artifacts." : "All reactor cases matched.");
