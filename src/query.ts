import {
  analyzeHornCounterfactual,
  analyzeHornDominators,
  deriveHornDialogueFrontier,
  deriveHornDialogueGraph,
} from "./analysis";
import type { HornDocument, RelationKind } from "./types";

export type HornQueryOperation = "graph" | "counterfactual" | "dominators";

export type HornQueryRequest = {
  version: "horn-query-request/0.1";
  operation: HornQueryOperation;
  focusNodeId: string;
  targetNodeId?: string;
  relationKinds?: RelationKind[];
  suppress?: {
    nodeIds?: string[];
    relationIds?: string[];
  };
};

export type HornQueryProblem = {
  code: string;
  message: string;
};

export type HornQueryResult = {
  version: "horn-query-result/0.1";
  requestVersion: "horn-query-request/0.1";
  operation: HornQueryOperation;
  source: {
    documentId: string;
    documentVersion: "horn-document/0.1";
  };
  result: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validRelationKind(value: unknown): value is RelationKind {
  return (
    value === "supports" ||
    value === "disputes" ||
    value === "warrants" ||
    value === "addresses" ||
    value === "interprets-as" ||
    (typeof value === "string" && value.startsWith("x-") && value.length > 2)
  );
}

function validateStringArray(
  problems: HornQueryProblem[],
  value: unknown,
  code: string,
  subject: string,
): void {
  if (!Array.isArray(value)) {
    problems.push({ code, message: `${subject} must be an array` });
    return;
  }
  value.forEach((entry, index) => {
    if (!nonEmptyString(entry)) {
      problems.push({ code, message: `${subject}[${index}] must be a non-empty string` });
    }
  });
}

export function validateHornQueryRequest(value: unknown): HornQueryProblem[] {
  const problems: HornQueryProblem[] = [];
  if (!isRecord(value)) {
    return [{ code: "invalid-query", message: "query request must be an object" }];
  }

  if (value.version !== "horn-query-request/0.1") {
    problems.push({
      code: "version",
      message: `unsupported query request version ${String(value.version)}`,
    });
  }

  if (!["graph", "counterfactual", "dominators"].includes(String(value.operation))) {
    problems.push({
      code: "operation",
      message: `unsupported query operation ${String(value.operation)}`,
    });
  }

  if (!nonEmptyString(value.focusNodeId)) {
    problems.push({ code: "missing-focus", message: "query request needs focusNodeId" });
  }

  if (value.operation === "dominators" && !nonEmptyString(value.targetNodeId)) {
    problems.push({
      code: "missing-target",
      message: "dominators query needs targetNodeId",
    });
  }

  if (value.targetNodeId !== undefined && !nonEmptyString(value.targetNodeId)) {
    problems.push({ code: "invalid-target", message: "targetNodeId must be a non-empty string" });
  }

  if (value.relationKinds !== undefined) {
    if (!Array.isArray(value.relationKinds)) {
      problems.push({ code: "invalid-relation-kinds", message: "relationKinds must be an array" });
    } else {
      value.relationKinds.forEach((kind, index) => {
        if (!validRelationKind(kind)) {
          problems.push({
            code: "invalid-relation-kind",
            message: `relationKinds[${index}] is not a Horn relation kind`,
          });
        }
      });
    }
  }

  if (value.suppress !== undefined) {
    if (!isRecord(value.suppress)) {
      problems.push({ code: "invalid-suppress", message: "suppress must be an object" });
    } else {
      if (value.suppress.nodeIds !== undefined) {
        validateStringArray(
          problems,
          value.suppress.nodeIds,
          "invalid-suppressed-node",
          "suppress.nodeIds",
        );
      }
      if (value.suppress.relationIds !== undefined) {
        validateStringArray(
          problems,
          value.suppress.relationIds,
          "invalid-suppressed-relation",
          "suppress.relationIds",
        );
      }
    }
  }

  if (value.operation !== "counterfactual" && value.suppress !== undefined) {
    problems.push({
      code: "suppress-on-noncounterfactual",
      message: "suppress is only valid for counterfactual queries",
    });
  }

  return problems.sort((left, right) =>
    left.code === right.code
      ? left.message.localeCompare(right.message)
      : left.code.localeCompare(right.code),
  );
}

function requireValidRequest(value: unknown): HornQueryRequest {
  const problems = validateHornQueryRequest(value);
  if (problems.length > 0) {
    throw new Error(
      `invalid Horn query request: ${problems.map((problem) => `${problem.code}: ${problem.message}`).join("; ")}`,
    );
  }
  return value as HornQueryRequest;
}

export function executeHornQuery(
  document: HornDocument,
  requestValue: unknown,
): HornQueryResult {
  const request = requireValidRequest(requestValue);
  const commonOptions = request.relationKinds
    ? { relationKinds: request.relationKinds }
    : {};

  let result: Record<string, unknown>;
  switch (request.operation) {
    case "graph": {
      const graph = deriveHornDialogueGraph(document, request.focusNodeId, commonOptions);
      result = {
        focusNodeId: graph.focusNodeId,
        nodeIds: graph.nodeIds,
        edges: graph.edges,
        frontierNodeIds: deriveHornDialogueFrontier(graph),
      };
      break;
    }
    case "counterfactual": {
      const analysis = analyzeHornCounterfactual(document, request.focusNodeId, {
        ...commonOptions,
        ...(request.suppress?.nodeIds
          ? { suppressedNodeIds: request.suppress.nodeIds }
          : {}),
        ...(request.suppress?.relationIds
          ? { suppressedRelationIds: request.suppress.relationIds }
          : {}),
      });
      const { version: _version, source: _source, ...payload } = analysis;
      result = payload;
      break;
    }
    case "dominators": {
      const analysis = analyzeHornDominators(
        document,
        request.focusNodeId,
        request.targetNodeId!,
        commonOptions,
      );
      const { version: _version, source: _source, ...payload } = analysis;
      result = payload;
      break;
    }
  }

  return {
    version: "horn-query-result/0.1",
    requestVersion: request.version,
    operation: request.operation,
    source: {
      documentId: document.id,
      documentVersion: document.version,
    },
    result,
  };
}
