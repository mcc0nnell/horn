#!/usr/bin/env node
/**
 * Golden Horn tape corpus over a source-calibrated CCT Map 1 specimen.
 *
 * This pass freezes the real traversal plans and their semantic/fork
 * invariants. Literal receipt/tape digests are intentionally not pinned until
 * the first trusted full-repository/external-CI run establishes the contract
 * on the stacked branch.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const corpus = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const source = join(repoRoot, corpus.source);
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

function runCapture(args, label) {
  const result = spawnSync(process.execPath, [tsx, ...args], {
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

if (!existsSync(tsx)) {
  throw new Error(
    `tsx not found at ${tsx}. Install repository dependencies before running golden:tape.`,
  );
}

const scratch = mkdtempSync(join(tmpdir(), "horn-tape-golden-"));
const tapes = new Map();
let failures = 0;

try {
  for (const testCase of corpus.cases) {
    const planPath = join(scratch, `${testCase.name}.plan.json`);
    const tapePath = join(scratch, `${testCase.name}.tape.json`);
    writeFileSync(planPath, `${JSON.stringify(testCase.plan, null, 2)}\n`);

    try {
      const first = runCapture(
        [join(repoRoot, "src/cli/tape.ts"), source, planPath],
        `record ${testCase.name}`,
      );
      const second = runCapture(
        [join(repoRoot, "src/cli/tape.ts"), source, planPath],
        `record deterministic replay ${testCase.name}`,
      );

      if (stableStringify(JSON.parse(first)) !== stableStringify(JSON.parse(second))) {
        console.error(`non-deterministic tape output: ${testCase.name}`);
        failures += 1;
        continue;
      }

      const tape = JSON.parse(first);
      const expected = testCase.expected;
      if (tape.document?.id !== expected.documentId) {
        console.error(`document id mismatch: ${testCase.name}`);
        failures += 1;
      }
      if (tape.terminal?.nodeId !== expected.terminalNodeId) {
        console.error(`terminal node mismatch: ${testCase.name}`);
        failures += 1;
      }
      if (tape.events?.length !== expected.eventCount) {
        console.error(`event count mismatch: ${testCase.name}`);
        failures += 1;
      }

      const relationEvent = tape.events?.[expected.relationEvent.seq - 1];
      const payload = relationEvent?.payload;
      if (
        payload?.kind !== "follow-relation" ||
        payload.relationId !== expected.relationEvent.relationId ||
        payload.fromNodeId !== expected.relationEvent.fromNodeId ||
        payload.toNodeId !== expected.relationEvent.toNodeId
      ) {
        console.error(`reader-direction relation payload mismatch: ${testCase.name}`);
        failures += 1;
      }

      writeFileSync(tapePath, `${JSON.stringify(tape, null, 2)}\n`);
      const verificationText = runCapture(
        [join(repoRoot, "src/cli/replay-tape.ts"), source, tapePath],
        `verify ${testCase.name}`,
      );
      const report = JSON.parse(verificationText);
      if (
        report.valid !== true ||
        report.tapeId !== tape.id ||
        report.expectedTapeId !== tape.id ||
        report.terminalNodeId !== expected.terminalNodeId ||
        report.replayedEvents !== expected.eventCount ||
        !Array.isArray(report.issues) ||
        report.issues.length !== 0
      ) {
        console.error(`unexpected replay report: ${testCase.name}`);
        failures += 1;
        continue;
      }

      tapes.set(testCase.name, tape);
      console.log(
        `ok tape ${testCase.name} ${tape.id} terminal=${tape.terminal.digest}`,
      );
    } catch (error) {
      console.error(String(error instanceof Error ? error.message : error));
      failures += 1;
    }
  }

  const left = tapes.get(corpus.fork.left);
  const right = tapes.get(corpus.fork.right);
  if (!left || !right) {
    console.error("fork invariant unavailable because one branch failed");
    failures += 1;
  } else {
    if (
      left.document.sha256 !== right.document.sha256 ||
      left.genesisDigest !== right.genesisDigest
    ) {
      console.error("fork branches do not share one source/genesis");
      failures += 1;
    }

    for (let index = 0; index < corpus.fork.sharedPrefixEvents; index += 1) {
      if (
        stableStringify(left.events[index]?.payload) !==
          stableStringify(right.events[index]?.payload) ||
        left.events[index]?.receiptDigest !== right.events[index]?.receiptDigest
      ) {
        console.error(`fork shared-prefix mismatch at event ${index + 1}`);
        failures += 1;
      }
    }

    const divergenceIndex = corpus.fork.divergenceEvent - 1;
    if (
      left.events[divergenceIndex]?.previousDigest !==
      right.events[divergenceIndex]?.previousDigest
    ) {
      console.error("fork divergence does not begin from the same prior receipt");
      failures += 1;
    }
    if (
      left.events[divergenceIndex]?.receiptDigest ===
        right.events[divergenceIndex]?.receiptDigest ||
      left.terminal.digest === right.terminal.digest ||
      left.id === right.id
    ) {
      console.error("fork divergence failed to produce distinct receipt histories");
      failures += 1;
    } else {
      console.log(
        `ok fork shared=${corpus.fork.sharedPrefixEvents} divergence=${corpus.fork.divergenceEvent}`,
      );
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`golden:tape failed (${failures} mismatch(es))`);
  process.exit(1);
}

console.log(`All ${corpus.cases.length} CCT tape case(s) matched.`);
