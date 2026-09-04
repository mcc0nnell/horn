import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  HornZeppelinValidationError,
  inspectHornSource,
  muralToZeppelinHtml,
  prepareHornDocument,
  projectAudit,
  projectManifest,
  projectNetwork,
} from "./adapter";

const commands = ["validate", "render", "network", "audit", "manifest"] as const;
type Command = (typeof commands)[number];

function usage(): never {
  process.stderr.write(
    "usage: horn-zeppelin <validate|render|network|audit|manifest> <document.horn.json>\n",
  );
  process.exit(64);
}

function isCommand(value: string | undefined): value is Command {
  return value !== undefined && commands.includes(value as Command);
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const [commandValue, pathValue] = process.argv.slice(2);
if (!isCommand(commandValue) || !pathValue) {
  usage();
}

const source = readFileSync(resolve(pathValue));

try {
  if (commandValue === "validate") {
    const inspection = inspectHornSource(source);
    writeJson(inspection);
    if (!inspection.valid) {
      process.exitCode = 2;
    }
  } else {
    const prepared = prepareHornDocument(source);
    switch (commandValue) {
      case "render":
        process.stdout.write(`%html\n${muralToZeppelinHtml(prepared)}\n`);
        break;
      case "network":
        process.stdout.write(`%network ${JSON.stringify(projectNetwork(prepared))}\n`);
        break;
      case "audit":
        writeJson(projectAudit(prepared));
        break;
      case "manifest":
        writeJson(projectManifest(prepared));
        break;
    }
  }
} catch (error) {
  if (error instanceof HornZeppelinValidationError) {
    writeJson({ valid: false, issues: error.issues });
    process.exitCode = 2;
  } else {
    throw error;
  }
}
