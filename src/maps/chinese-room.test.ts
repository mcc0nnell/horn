import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderHornSvg } from "../render";
import type { HornDocument } from "../types";
import { validateHornDocument } from "../validate";

const source = readFileSync(
  new URL("../../maps/chinese-room-slice.horn.json", import.meta.url),
  "utf8",
);
const document = JSON.parse(source) as HornDocument;

test("Chinese Room authored specimen validates", () => {
  assert.deepEqual(validateHornDocument(document), []);
});

test("Chinese Room authored specimen has persisted geometry for every relation", () => {
  assert.equal(document.relations.length, 10);
  assert.ok(document.relations.every((relation) => relation.route));
});

test("Chinese Room authored specimen renders with no missing-route warnings", () => {
  const result = renderHornSvg(document);
  assert.deepEqual(result.warnings, []);
  assert.equal((result.svg.match(/data-horn-relation=/g) ?? []).length, 10);
});

test("Chinese Room route provenance is explicit", () => {
  assert.equal(
    document.extensions?.routeProvenance,
    "Relation routes are authored reconstruction geometry created in 2026 for this after-Horn specimen. They are not recovered MacroVU poster geometry.",
  );
});
