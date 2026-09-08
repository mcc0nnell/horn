#!/usr/bin/env node
/**
 * Proves that reasoning composition lives inside the Celix service plane.
 * The driver transports an opaque session envelope between invocations; the
 * IReasoningSessionService owns binding resolution, JSON Pointer selection,
 * downstream service discovery, binding metadata, and non-promotion checks.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const nativeDir = process.env.HORN_NATIVE_BIN?.trim() || join(repoRoot, "build/native");
const hornCelix = process.env.HORN_CELIX?.trim() || join(nativeDir, "horn_celix");

if (!existsSync(hornCelix)) {
  throw new Error(
    `horn_celix not found at ${hornCelix}. Configure with -DHORN_WITH_CELIX=ON or set HORN_CELIX.`,
  );
}

const env = {
  ...process.env,
  LD_LIBRARY_PATH: [
    join(nativeDir, "celix-root/celix/lib"),
    join(nativeDir, "celix-root/deps/lib"),
    process.env.LD_LIBRARY_PATH ?? "",
  ]
    .filter(Boolean)
    .join(":"),
};

function invoke(args, expectSuccess = true) {
  const result = spawnSync(hornCelix, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env,
  });
  if (result.error) {
    throw result.error;
  }
  if (expectSuccess && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `exit ${result.status}`).trim());
  }
  return result;
}

function writeRequest(dir, name, value) {
  const path = join(dir, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

function canonical(value) {
  return { authority: "canonical", value };
}

function literal(value) {
  return { value };
}

function ref(value) {
  return { ref: value };
}

const document = JSON.parse(
  readFileSync(join(repoRoot, "maps/chinese-room-slice.horn.json"), "utf8"),
);
const query = JSON.parse(
  readFileSync(join(repoRoot, "golden/reactor/queries/node-lookup.json"), "utf8"),
);
const expectedQuery = JSON.parse(
  readFileSync(join(repoRoot, "golden/celix/expected/query-node-lookup.json"), "utf8"),
);

const dir = mkdtempSync(join(tmpdir(), "horn-celix-session-"));
try {
  const initialSession = {
    version: "horn-reasoning-session/0.1",
    id: "golden:celix-session",
    ephemeral: true,
    bindings: [],
  };

  const queryRequest = {
    version: "horn-reasoning-session-request/0.1",
    session: initialSession,
    command: {
      op: "query",
      document: canonical(document),
      request: literal(query),
    },
    bind: "lookup",
  };
  const queryResponse = JSON.parse(
    invoke(["session", writeRequest(dir, "query.json", queryRequest)]).stdout,
  );
  if (queryResponse.version !== "horn-reasoning-session-response/0.1") {
    throw new Error(`unexpected session response contract ${queryResponse.version}`);
  }
  if (JSON.stringify(queryResponse.result) !== JSON.stringify(expectedQuery)) {
    throw new Error("session query result diverged from the Celix query golden");
  }
  const lookup = queryResponse.session?.bindings?.find((binding) => binding.name === "lookup");
  if (
    !lookup ||
    lookup.command !== "query" ||
    lookup.contract !== "horn-query-result/0.1" ||
    typeof lookup.sha256 !== "string" ||
    !lookup.sha256.startsWith("sha256:")
  ) {
    throw new Error("query binding metadata was not produced by the session service");
  }

  const explainRequest = {
    version: "horn-reasoning-session-request/0.1",
    session: queryResponse.session,
    command: {
      op: "explain",
      document: canonical(document),
      identity: ref("@lookup#/node/id"),
      support: [],
    },
    bind: "explanation",
  };
  const explainResponse = JSON.parse(
    invoke(["session", writeRequest(dir, "explain.json", explainRequest)]).stdout,
  );
  if (
    explainResponse.result?.version !== "horn-explanation/0.1" ||
    explainResponse.result?.identity !== "c1-machines-can-think" ||
    explainResponse.result?.ok !== true
  ) {
    throw new Error("session JSON Pointer did not feed the explanation service");
  }

  const bindingsRequest = {
    version: "horn-reasoning-session-request/0.1",
    session: explainResponse.session,
    command: { op: "bindings" },
  };
  const bindingsResponse = JSON.parse(
    invoke(["session", writeRequest(dir, "bindings.json", bindingsRequest)]).stdout,
  );
  if (
    bindingsResponse.result?.version !== "horn-reasoning-bindings/0.1" ||
    bindingsResponse.result?.ephemeral !== true ||
    bindingsResponse.result?.bindings?.length !== 2
  ) {
    throw new Error("session binding summary contract is missing or incomplete");
  }

  const illegalPromotion = {
    version: "horn-reasoning-session-request/0.1",
    session: explainResponse.session,
    command: {
      op: "diff",
      before: ref("@lookup"),
      after: canonical(document),
    },
  };
  const rejected = invoke(
    ["session", writeRequest(dir, "illegal-promotion.json", illegalPromotion)],
    false,
  );
  if (rejected.status === 0) {
    throw new Error("Celix reasoning session accepted a derived binding as a Horn document");
  }
  const rejectionText = `${rejected.stderr}\n${rejected.stdout}`;
  if (!rejectionText.includes("explicit canonical Horn document")) {
    throw new Error(`unexpected non-promotion failure: ${rejectionText.trim()}`);
  }

  console.log("Celix reasoning session composition passed.");
  console.log("query -> @lookup#/node/id -> explanation");
  console.log("derived binding -> canonical document promotion rejected");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
