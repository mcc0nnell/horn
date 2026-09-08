import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseProjectionView,
  projectAnalyticalView,
  stringifyProjection,
} from "../analysis/projection.js";
import type { HornDocument } from "../types.js";

const [documentPath, viewName] = process.argv.slice(2);
if (!documentPath || !viewName) {
  throw new Error(
    "Usage: tsx src/cli/project.ts <document> <argument|timeline|evidence|frontier>",
  );
}

const source = readFileSync(resolve(documentPath), "utf8");
const document = JSON.parse(source) as HornDocument;
const projection = projectAnalyticalView(document, parseProjectionView(viewName));
process.stdout.write(stringifyProjection(projection));
