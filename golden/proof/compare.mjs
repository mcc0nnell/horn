#!/usr/bin/env node
/**
 * Golden proof equivalence: TypeScript vs native C++ proof creation and replay.
 *
 * The checked-in anchors are content-addressed proof IDs plus full-source and
 * structural-dependency digests. TypeScript and C++ must also emit the same
 * canonical proof object and the same verification report.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const cases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const fixture = join(repoRoot, "golden/query/reactor-diamond.horn.json");
const hornProof =
  process.env.HORN_PROOF?.trim() || join(repoRoot, "build/native/horn_proof");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");

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
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `${label} exited ${result.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  return result.stdout;
}

if (!existsSync(hornProof)) {
  throw new Error(
    `Native horn_proof binary not found at ${hornProof}. ` +
      `Build with: cmake -S native -B build/native && cmake --build build/native ` +
      `(or set HORN_PROOF).`,
  );
}

const scratch = mkdtempSync(join(tmpdir(), "horn-proof-golden-"));
let failures = 0;

try {
  for (const testCase of cases) {
    const requestPath = join(scratch, `${testCase.name}-request.json`);
    const proofPath = join(scratch, `${testCase.name}-proof.json`);
    writeFileSync(requestPath, `${JSON.stringify(testCase.request, null, 2)}\n`);

    try {
      const tsProofText = runCapture(
        process.execPath,
        [tsx, join(repoRoot, "src/cli/prove.ts"), fixture, requestPath],
        `TypeScript proof create (${testCase.name})`,
      );
      const nativeProofText = runCapture(
        hornProof,
        ["create", fixture, requestPath],
        `Native proof create (${testCase.name})`,
      );

      const tsCanonical = canonicalizeJsonText(tsProofText);
      const nativeCanonical = canonicalizeJsonText(nativeProofText);
      if (tsCanonical !== nativeCanonical) {
        console.error(`proof object mismatch: ${testCase.name}`);
        failures += 1;
        continue;
      }

      const proof = JSON.parse(tsProofText);
      const expected = testCase.expected;
      if (proof.id !== expected.proofId) {
        console.error(
          `proof id mismatch ${testCase.name}: ${proof.id} != ${expected.proofId}`,
        );
        failures += 1;
      }
      if (proof.source?.canonicalSha256 !== expected.sourceSha256) {
        console.error(`source digest mismatch: ${testCase.name}`);
        failures += 1;
      }
      if (proof.dependencies?.canonicalSha256 !== expected.dependencySha256) {
        console.error(`dependency digest mismatch: ${testCase.name}`);
        failures += 1;
      }

      writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);

      const tsVerificationText = runCapture(
        process.execPath,
        [tsx, join(repoRoot, "src/cli/verify-proof.ts"), fixture, proofPath],
        `TypeScript proof verify (${testCase.name})`,
      );
      const nativeVerificationText = runCapture(
        hornProof,
        ["verify", fixture, proofPath],
        `Native proof verify (${testCase.name})`,
      );

      if (
        canonicalizeJsonText(tsVerificationText) !==
        canonicalizeJsonText(nativeVerificationText)
      ) {
        console.error(`verification report mismatch: ${testCase.name}`);
        failures += 1;
        continue;
      }

      const report = JSON.parse(tsVerificationText);
      if (
        report.ok !== true ||
        report.proofId !== expected.proofId ||
        !Array.isArray(report.issues) ||
        report.issues.length !== 0
      ) {
        console.error(`unexpected verification report: ${testCase.name}`);
        failures += 1;
        continue;
      }

      console.log(`ok proof ${testCase.name} ${expected.proofId}`);
    } catch (error) {
      console.error(String(error instanceof Error ? error.message : error));
      failures += 1;
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`golden:proof failed (${failures} mismatch(es))`);
  process.exit(1);
}

console.log(`All ${cases.length} proof case(s) matched.`);
