import assert from "node:assert/strict";
import test from "node:test";

import {
  HornProjectionError,
  resolveHornProjection,
  type HornProjectionManifest,
} from "./projection.js";
import type { HornDocument } from "./types.js";

const document: HornDocument = {
  id: "demo",
  version: "horn-document/0.1",
  vocabulary: [],
  unitSize: "concept-diagram",
  authority: "authored",
  after: { name: "test", works: ["source"] },
  title: "Demo",
  subtitle: "",
  issueQuestion: "What follows?",
  canvas: { width: 100, height: 100, unit: "px", origin: "top-left" },
  regions: [],
  nodes: [
    {
      id: "a",
      number: 1,
      kind: "claim",
      origin: "authored",
      label: "A",
      text: "A",
      geometry: { x: 0, y: 0, w: 10, h: 10 },
      citationIds: ["cartography"],
    },
    {
      id: "b",
      number: 2,
      kind: "claim",
      origin: "authored",
      label: "B",
      text: "B",
      geometry: { x: 20, y: 0, w: 10, h: 10 },
      citationIds: ["cartography"],
    },
  ],
  relations: [
    { id: "a-b", kind: "supports", from: "a", to: "b", label: "supports" },
  ],
  citations: [
    {
      id: "cartography",
      layer: "cartographic",
      citation: "Authored test document",
      short: "test",
      year: 2026,
    },
  ],
  readingPath: ["a", "b"],
  rights: "test",
};

function manifest(
  overrides: Partial<HornProjectionManifest> = {},
): HornProjectionManifest {
  return {
    id: "demo-rustbelt",
    version: "horn-projection/0.1",
    source: { documentId: "demo", documentVersion: "horn-document/0.1" },
    target: "rustbelt",
    nodes: ["a", "b"],
    relations: ["a-b"],
    ...overrides,
  };
}

test("resolves Horn identities without rewriting them", () => {
  const resolved = resolveHornProjection(document, manifest());
  assert.deepEqual(resolved.nodes.map((node) => node.id), ["a", "b"]);
  assert.deepEqual(resolved.relations.map((relation) => relation.id), ["a-b"]);
  assert.equal(resolved.nodes[0], document.nodes[0]);
  assert.equal(resolved.relations[0], document.relations[0]);
});

test("rejects a projection for another Horn document", () => {
  assert.throws(
    () =>
      resolveHornProjection(
        document,
        manifest({
          source: {
            documentId: "somewhere-else",
            documentVersion: "horn-document/0.1",
          },
        }),
      ),
    (error: unknown) =>
      error instanceof HornProjectionError &&
      error.codes.includes("E_SOURCE_DOCUMENT_ID"),
  );
});

test("rejects unknown source identities", () => {
  assert.throws(
    () => resolveHornProjection(document, manifest({ nodes: ["missing"] })),
    (error: unknown) =>
      error instanceof HornProjectionError &&
      error.codes.includes("E_NODE_NOT_FOUND:missing"),
  );
});

test("rejects relations whose endpoints are outside the selected node set", () => {
  assert.throws(
    () => resolveHornProjection(document, manifest({ nodes: ["a"] })),
    (error: unknown) =>
      error instanceof HornProjectionError &&
      error.codes.includes("E_RELATION_OUTSIDE_NODE_SET:a-b"),
  );
});
