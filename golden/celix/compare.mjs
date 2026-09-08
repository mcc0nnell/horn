#!/usr/bin/env node
/**
 * Three-way golden: TypeScript, native standalone CLIs, and native-under-Celix.
 * Celix invocations go through discovered services inside a real framework.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const expectedDir = join(here, "expected");
const generate = process.argv.includes("--generate-expected");
const nativeDir = process.env.HORN_NATIVE_BIN?.trim() || join(repoRoot, "build/native");
const hornCelix = process.env.HORN_CELIX?.trim() || join(nativeDir, "horn_celix");

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
    env: {
      ...process.env,
      LD_LIBRARY_PATH: [
        join(nativeDir, "celix-root/celix/lib"),
        join(nativeDir, "celix-root/deps/lib"),
        process.env.LD_LIBRARY_PATH ?? "",
      ]
        .filter(Boolean)
        .join(":"),
    },
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
    throw new Error(`Native ${binary} not found at ${path}. Build libhorn or set HORN_NATIVE_BIN.`);
  }
  return runCapture(path, args, label);
}

function celix(args, label) {
  if (!existsSync(hornCelix)) {
    throw new Error(
      `horn_celix not found at ${hornCelix}. Configure with -DHORN_WITH_CELIX=ON or set HORN_CELIX.`,
    );
  }
  return runCapture(hornCelix, args, label);
}

function compareThree(name, tsOut, standaloneFn, celixFn) {
  const expectedPath = join(expectedDir, `${name}.json`);
  const tsCanon = canonicalizeJsonText(tsOut);
  if (generate) {
    writeFileSync(expectedPath, tsOut);
    console.log(`wrote expected ${expectedPath}`);
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
    console.log(`ok ts     ${name}`);
  }
  for (const [label, fn] of [
    ["cxx", standaloneFn],
    ["celix", celixFn],
  ]) {
    try {
      const out = fn();
      const canon = canonicalizeJsonText(out);
      if (canon !== expectedCanon) {
        console.error(`${label} mismatch ${name}`);
        failures += 1;
      } else if (out !== tsOut) {
        console.error(`${label}/TS pretty mismatch ${name}`);
        failures += 1;
      } else {
        console.log(`ok ${label.padEnd(6)} ${name}`);
      }
    } catch (error) {
      console.error(String(error instanceof Error ? error.message : error));
      failures += 1;
    }
  }
  return failures;
}

mkdirSync(expectedDir, { recursive: true });
let failures = 0;

const chinese = "maps/chinese-room-slice.horn.json";
const celixMap = "maps/celix-845-specimen-001.horn.json";
const evidence = "experiments/celix-845/evidence/sbom-physical-evidence.json";
const bindings = "experiments/celix-845/evidence/bindings.json";
const argument = "arguments/chinese-room.horn-argument.json";
const nodeLookup = "golden/reactor/queries/node-lookup.json";
const frontierQuery = "golden/reactor/queries/frontier.json";

failures += compareThree(
  "validate-chinese-room",
  tsx("src/cli/validate-report.ts", [chinese], "validate-chinese-room"),
  () => native("horn_validate", [join(repoRoot, chinese)], "validate-chinese-room"),
  () => celix(["validate", join(repoRoot, chinese)], "validate-chinese-room"),
);

failures += compareThree(
  "project-argument",
  tsx("src/cli/project.ts", [chinese, "argument"], "project-argument"),
  () => native("horn_project", [join(repoRoot, chinese), "argument"], "project-argument"),
  () => celix(["project", join(repoRoot, chinese), "argument"], "project-argument"),
);

failures += compareThree(
  "query-node-lookup",
  tsx("src/cli/query.ts", [chinese, nodeLookup], "query-node-lookup"),
  () =>
    native(
      "horn_query",
      [join(repoRoot, chinese), join(repoRoot, nodeLookup)],
      "query-node-lookup",
    ),
  () =>
    celix(
      ["query", join(repoRoot, chinese), join(repoRoot, nodeLookup)],
      "query-node-lookup",
    ),
);

failures += compareThree(
  "explain-c1",
  tsx("src/cli/explain.ts", [chinese, "c1-machines-can-think", argument], "explain-c1"),
  () =>
    native(
      "horn_explain",
      [join(repoRoot, chinese), "c1-machines-can-think", join(repoRoot, argument)],
      "explain-c1",
    ),
  () =>
    celix(
      ["explain", join(repoRoot, chinese), "c1-machines-can-think", join(repoRoot, argument)],
      "explain-c1",
    ),
);

failures += compareThree(
  "impact-celix",
  tsx("src/cli/impact.ts", [celixMap, evidence, bindings], "impact-celix"),
  () =>
    native(
      "horn_impact",
      [join(repoRoot, celixMap), join(repoRoot, evidence), join(repoRoot, bindings)],
      "impact-celix",
    ),
  () =>
    celix(
      ["impact", join(repoRoot, celixMap), join(repoRoot, evidence), join(repoRoot, bindings)],
      "impact-celix",
    ),
);

failures += compareThree(
  "diff-identity",
  tsx("src/cli/diff.ts", [chinese, chinese], "diff-identity"),
  () => native("horn_diff", [join(repoRoot, chinese), join(repoRoot, chinese)], "diff-identity"),
  () =>
    celix(["diff", join(repoRoot, chinese), join(repoRoot, chinese)], "diff-identity"),
);

failures += compareThree(
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
      frontierQuery,
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
        join(repoRoot, frontierQuery),
      ],
      "inspect-chinese-room",
    ),
  () =>
    celix(
      [
        "inspect",
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
        join(repoRoot, frontierQuery),
      ],
      "inspect-chinese-room",
    ),
);

try {
  const probeOut = celix(["probe"], "probe");
  const probe = JSON.parse(probeOut);
  const expectedProbePath = join(expectedDir, "probe.json");
  if (generate) {
    writeFileSync(expectedProbePath, probeOut);
    console.log(`wrote expected ${expectedProbePath}`);
  }
  const interfaces = (probe.services ?? []).map((service) => service.interface).sort();
  const required = [
    "horn::IDiffService",
    "horn::IExplanationService",
    "horn::IImpactService",
    "horn::IProjectionService",
    "horn::IQueryService",
    "horn::IReasoningSessionService",
    "horn::IRuntimeDescriptor",
    "horn::IValidationService",
  ];
  const missing = required.filter((name) => !interfaces.includes(name));
  if (missing.length > 0) {
    console.error(`probe missing services: ${missing.join(", ")} (have ${interfaces.join(", ")})`);
    failures += 1;
  } else if (probe.ok !== true) {
    console.error("probe ok != true");
    failures += 1;
  } else if (probe.pin?.commit !== "270c784d20dabd0b1f6418c7ee2195822ec9ef90") {
    console.error(`probe pin commit drifted: ${probe.pin?.commit}`);
    failures += 1;
  } else {
    console.log("ok celix  probe");
  }
  if (existsSync(expectedProbePath)) {
    const expectedProbe = canonicalizeJsonText(readFileSync(expectedProbePath, "utf8"));
    if (canonicalizeJsonText(probeOut) !== expectedProbe) {
      console.error("probe golden mismatch");
      failures += 1;
    }
  }
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  failures += 1;
}

if (failures > 0) {
  console.error(`golden:celix failed (${failures} mismatch(es))`);
  process.exit(1);
}

console.log(generate ? "Generated Celix expected artifacts." : "All Celix three-way cases matched.");
