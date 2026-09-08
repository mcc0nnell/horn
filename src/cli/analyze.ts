import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  analyzeHornCounterfactual,
  analyzeHornDominators,
  deriveHornDialogueFrontier,
  deriveHornDialogueGraph,
} from "../analysis";
import type { HornDocument, RelationKind } from "../types";

function valuesFor(flag: string, args: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) {
      const value = args[index + 1];
      if (!value) throw new Error(`${flag} requires a value`);
      values.push(value);
      index += 1;
    }
  }
  return values;
}

function relationKinds(args: string[]): RelationKind[] | undefined {
  const values = valuesFor("--relations", args)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean) as RelationKind[];
  return values.length > 0 ? values : undefined;
}

const [input, operation, focusNodeId, targetNodeId, ...rest] = process.argv.slice(2);
if (!input || !operation || !focusNodeId) {
  throw new Error(
    "Usage: tsx src/cli/analyze.ts <map.horn.json> <graph|counterfactual|dominators> <focus-node-id> [target-node-id] [--without-node ID] [--without-relation ID] [--relations kind,kind]",
  );
}

const source = readFileSync(resolve(input), "utf8");
const document = JSON.parse(source) as HornDocument;
const kinds = relationKinds(rest);

let output: unknown;
switch (operation) {
  case "graph": {
    const graph = deriveHornDialogueGraph(document, focusNodeId, {
      ...(kinds ? { relationKinds: kinds } : {}),
    });
    output = {
      version: "horn-dialogue-graph/0.1",
      source: { documentId: document.id, documentVersion: document.version },
      ...graph,
      frontierNodeIds: deriveHornDialogueFrontier(graph),
    };
    break;
  }
  case "counterfactual": {
    output = analyzeHornCounterfactual(document, focusNodeId, {
      ...(kinds ? { relationKinds: kinds } : {}),
      suppressedNodeIds: valuesFor("--without-node", rest),
      suppressedRelationIds: valuesFor("--without-relation", rest),
    });
    break;
  }
  case "dominators": {
    if (!targetNodeId || targetNodeId.startsWith("--")) {
      throw new Error("dominators requires a target node id");
    }
    output = analyzeHornDominators(document, focusNodeId, targetNodeId, {
      ...(kinds ? { relationKinds: kinds } : {}),
    });
    break;
  }
  default:
    throw new Error(`unknown analysis operation: ${operation}`);
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
