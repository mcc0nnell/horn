import {
  fingerprintEvidence,
  type EvidenceBinding,
  type EvidenceSnapshot,
} from "./invalidation";
import {
  validateHornQueryRequest,
  type HornQueryRequest,
} from "../query";

export type HornEvidenceContractProblem = {
  code: string;
  message: string;
};

export type HornEvidenceSnapshotArtifact = {
  version: "horn-evidence-snapshot/0.1";
  id: string;
  substrate: EvidenceSnapshot;
  interpretationBoundary: string;
  extensions?: Record<`x-${string}`, unknown>;
};

export type HornEvidenceBindingsArtifact = {
  version: "horn-evidence-bindings/0.1";
  id: string;
  document: {
    id: string;
    version: "horn-document/0.1";
  };
  bindings: EvidenceBinding[];
  semantics: string;
  extensions?: Record<`x-${string}`, unknown>;
};

export type HornEvidenceImpactRequest = {
  version: "horn-evidence-impact-request/0.1";
  queries: HornQueryRequest[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushUnexpectedKeys(
  problems: HornEvidenceContractProblem[],
  value: Record<string, unknown>,
  allowed: readonly string[],
  subject: string,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      problems.push({
        code: "unexpected-property",
        message: `${subject} contains unexpected property ${key}`,
      });
    }
  }
}

function validateExtensions(
  problems: HornEvidenceContractProblem[],
  value: unknown,
  subject: string,
): void {
  if (!isRecord(value)) {
    problems.push({ code: "invalid-extensions", message: `${subject} must be an object` });
    return;
  }
  for (const key of Object.keys(value)) {
    if (!key.startsWith("x-") || key.length <= 2) {
      problems.push({
        code: "invalid-extension-key",
        message: `${subject} key ${key} must begin with x-`,
      });
    }
  }
}

function validateSnapshotSubstrate(
  problems: HornEvidenceContractProblem[],
  value: unknown,
): void {
  if (!isRecord(value)) {
    problems.push({ code: "invalid-substrate", message: "evidence substrate must be an object" });
    return;
  }
  pushUnexpectedKeys(problems, value, ["components", "dependencyGraph"], "evidence substrate");

  if (!isRecord(value.components)) {
    problems.push({ code: "invalid-components", message: "substrate.components must be an object" });
  } else {
    for (const [component, version] of Object.entries(value.components)) {
      if (!nonEmptyString(component) || !nonEmptyString(version)) {
        problems.push({
          code: "invalid-component",
          message: "component names and versions must be non-empty strings",
        });
      }
    }
  }

  if (!isRecord(value.dependencyGraph)) {
    problems.push({
      code: "invalid-dependency-graph",
      message: "substrate.dependencyGraph must be an object",
    });
  } else {
    for (const [component, dependencies] of Object.entries(value.dependencyGraph)) {
      if (!nonEmptyString(component) || !Array.isArray(dependencies)) {
        problems.push({
          code: "invalid-dependency-entry",
          message: `dependency entry ${component} must be an array`,
        });
        continue;
      }
      const seen = new Set<string>();
      dependencies.forEach((dependency, index) => {
        if (!nonEmptyString(dependency)) {
          problems.push({
            code: "invalid-dependency",
            message: `dependency ${component}[${index}] must be a non-empty string`,
          });
          return;
        }
        if (seen.has(dependency)) {
          problems.push({
            code: "duplicate-dependency",
            message: `dependency entry ${component} repeats ${dependency}`,
          });
        }
        seen.add(dependency);
      });
    }
  }
}

export function validateHornEvidenceSnapshotArtifact(
  value: unknown,
): HornEvidenceContractProblem[] {
  const problems: HornEvidenceContractProblem[] = [];
  if (!isRecord(value)) {
    return [{ code: "invalid-evidence-snapshot", message: "evidence snapshot must be an object" }];
  }

  pushUnexpectedKeys(
    problems,
    value,
    ["version", "id", "substrate", "interpretationBoundary", "extensions"],
    "evidence snapshot",
  );

  if (value.version !== "horn-evidence-snapshot/0.1") {
    problems.push({ code: "version", message: "unsupported evidence snapshot version" });
  }
  if (!nonEmptyString(value.id)) {
    problems.push({ code: "missing-id", message: "evidence snapshot needs an id" });
  }
  validateSnapshotSubstrate(problems, value.substrate);
  if (!nonEmptyString(value.interpretationBoundary)) {
    problems.push({
      code: "missing-interpretation-boundary",
      message: "evidence snapshot needs an interpretationBoundary",
    });
  }
  if (value.extensions !== undefined) {
    validateExtensions(problems, value.extensions, "evidence snapshot extensions");
  }

  return problems.sort((left, right) =>
    left.code === right.code
      ? left.message.localeCompare(right.message)
      : left.code.localeCompare(right.code),
  );
}

export function validateHornEvidenceBindingsArtifact(
  value: unknown,
): HornEvidenceContractProblem[] {
  const problems: HornEvidenceContractProblem[] = [];
  if (!isRecord(value)) {
    return [{ code: "invalid-evidence-bindings", message: "evidence bindings must be an object" }];
  }

  pushUnexpectedKeys(
    problems,
    value,
    ["version", "id", "document", "bindings", "semantics", "extensions"],
    "evidence bindings",
  );

  if (value.version !== "horn-evidence-bindings/0.1") {
    problems.push({ code: "version", message: "unsupported evidence bindings version" });
  }
  if (!nonEmptyString(value.id)) {
    problems.push({ code: "missing-id", message: "evidence bindings need an id" });
  }

  if (!isRecord(value.document)) {
    problems.push({ code: "invalid-document", message: "evidence bindings need document metadata" });
  } else {
    pushUnexpectedKeys(problems, value.document, ["id", "version"], "bindings document");
    if (!nonEmptyString(value.document.id)) {
      problems.push({ code: "missing-document-id", message: "bindings document needs an id" });
    }
    if (value.document.version !== "horn-document/0.1") {
      problems.push({
        code: "document-version",
        message: "bindings document must target horn-document/0.1",
      });
    }
  }

  if (!Array.isArray(value.bindings)) {
    problems.push({ code: "invalid-bindings", message: "bindings must be an array" });
  } else {
    value.bindings.forEach((binding, index) => {
      const subject = `binding ${index}`;
      if (!isRecord(binding)) {
        problems.push({ code: "invalid-binding", message: `${subject} must be an object` });
        return;
      }
      pushUnexpectedKeys(
        problems,
        binding,
        ["evidenceId", "nodeIds", "expectedFingerprint", "rationale"],
        subject,
      );
      if (!nonEmptyString(binding.evidenceId)) {
        problems.push({ code: "missing-evidence-id", message: `${subject} needs evidenceId` });
      }
      if (!Array.isArray(binding.nodeIds) || binding.nodeIds.length < 1) {
        problems.push({ code: "invalid-node-ids", message: `${subject} needs at least one node id` });
      } else {
        const seen = new Set<string>();
        binding.nodeIds.forEach((nodeId, nodeIndex) => {
          if (!nonEmptyString(nodeId)) {
            problems.push({
              code: "invalid-node-id",
              message: `${subject} nodeIds[${nodeIndex}] must be a non-empty string`,
            });
            return;
          }
          if (seen.has(nodeId)) {
            problems.push({ code: "duplicate-node-id", message: `${subject} repeats ${nodeId}` });
          }
          seen.add(nodeId);
        });
      }
      if (
        typeof binding.expectedFingerprint !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(binding.expectedFingerprint)
      ) {
        problems.push({
          code: "invalid-expected-fingerprint",
          message: `${subject} needs a sha256 fingerprint`,
        });
      }
      if (!nonEmptyString(binding.rationale)) {
        problems.push({ code: "missing-rationale", message: `${subject} needs a rationale` });
      }
    });
  }

  if (!nonEmptyString(value.semantics)) {
    problems.push({ code: "missing-semantics", message: "evidence bindings need semantics" });
  }
  if (value.extensions !== undefined) {
    validateExtensions(problems, value.extensions, "evidence bindings extensions");
  }

  return problems.sort((left, right) =>
    left.code === right.code
      ? left.message.localeCompare(right.message)
      : left.code.localeCompare(right.code),
  );
}

export function validateHornEvidenceImpactRequest(
  value: unknown,
): HornEvidenceContractProblem[] {
  const problems: HornEvidenceContractProblem[] = [];
  if (!isRecord(value)) {
    return [{ code: "invalid-impact-request", message: "evidence impact request must be an object" }];
  }
  pushUnexpectedKeys(problems, value, ["version", "queries"], "evidence impact request");
  if (value.version !== "horn-evidence-impact-request/0.1") {
    problems.push({ code: "version", message: "unsupported evidence impact request version" });
  }
  if (!Array.isArray(value.queries)) {
    problems.push({ code: "invalid-queries", message: "evidence impact request queries must be an array" });
  } else {
    value.queries.forEach((query, index) => {
      for (const problem of validateHornQueryRequest(query)) {
        problems.push({
          code: `query-${problem.code}`,
          message: `query ${index}: ${problem.message}`,
        });
      }
    });
  }
  return problems.sort((left, right) =>
    left.code === right.code
      ? left.message.localeCompare(right.message)
      : left.code.localeCompare(right.code),
  );
}

function requireValid<T>(
  value: unknown,
  validate: (candidate: unknown) => HornEvidenceContractProblem[],
  subject: string,
): T {
  const problems = validate(value);
  if (problems.length > 0) {
    throw new Error(
      `invalid ${subject}: ${problems.map((problem) => `${problem.code}: ${problem.message}`).join("; ")}`,
    );
  }
  return value as T;
}

export function evidenceSnapshotFromArtifact(value: unknown): EvidenceSnapshot {
  return requireValid<HornEvidenceSnapshotArtifact>(
    value,
    validateHornEvidenceSnapshotArtifact,
    "Horn evidence snapshot",
  ).substrate;
}

export function evidenceBindingsFromArtifact(value: unknown): EvidenceBinding[] {
  return requireValid<HornEvidenceBindingsArtifact>(
    value,
    validateHornEvidenceBindingsArtifact,
    "Horn evidence bindings",
  ).bindings;
}

export function evidenceImpactQueriesFromArtifact(value: unknown): HornQueryRequest[] {
  return requireValid<HornEvidenceImpactRequest>(
    value,
    validateHornEvidenceImpactRequest,
    "Horn evidence impact request",
  ).queries;
}

export function fingerprintHornEvidenceArtifact(value: unknown): string {
  return fingerprintEvidence(evidenceSnapshotFromArtifact(value));
}
