import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { HornDocument } from "../types";
import { validateHornDocument } from "../validate";

const source = readFileSync(
  new URL("../../maps/celix-845-specimen-001.horn.json", import.meta.url),
  "utf8",
);
const document = JSON.parse(source) as HornDocument;

test("Celix 845 authored specimen validates", () => {
  assert.deepEqual(validateHornDocument(document), []);
});

test("Celix 845 keeps mapped evidence separate from cartographic provenance", () => {
  const mapped = document.citations.filter((citation) => citation.layer === "mapped");
  const cartographic = document.citations.filter(
    (citation) => citation.layer === "cartographic",
  );

  assert.ok(mapped.length >= 10);
  assert.equal(cartographic.length, 1);
});

test("Celix 845 reconstruction does not invent supply-chain relation kinds", () => {
  const relationKinds = new Set(document.relations.map((relation) => relation.kind));
  assert.deepEqual(
    [...relationKinds].sort(),
    ["addresses", "disputes", "supports"],
  );
});

test("safe-default reference state is the focus claim", () => {
  const focusNodes = document.nodes.filter((node) => node.focus);
  assert.equal(focusNodes.length, 1);
  assert.equal(focusNodes[0]?.id, "c6-safe-default");
});
