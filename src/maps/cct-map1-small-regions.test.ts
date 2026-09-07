import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderHornSvg } from "../render";
import { deriveHornThread } from "../structure";
import type { HornDocument } from "../types";
import { validateHornDocument } from "../validate";

const source = readFileSync(
  new URL("../../maps/cct-map1-small-regions.horn.json", import.meta.url),
  "utf8",
);
const document = JSON.parse(source) as HornDocument;

test("historical CCT small-region slice validates", () => {
  assert.deepEqual(validateHornDocument(document), []);
  assert.equal(document.authority, "historical");
  assert.equal(document.nodes.length, 7);
  assert.equal(document.relations.length, 4);
});

test("every historical relation has a calibrated persisted route", () => {
  assert.ok(document.relations.every((relation) => relation.route));
  assert.ok(
    document.relations.every(
      (relation) => relation.route?.extensions?.status === "centerline-approximation",
    ),
  );
});

test("source-calibrated historical slice renders without missing-route warnings", () => {
  const result = renderHornSvg(document);
  assert.deepEqual(result.warnings, []);
  assert.equal((result.svg.match(/data-horn-relation=/g) ?? []).length, 4);
});

test("reader-facing threads recover the three calibrated issue-area frontiers", () => {
  assert.deepEqual(
    deriveHornThread(document, "map1:box-59").frontierNodeIds,
    ["map1:box-60"],
  );
  assert.deepEqual(
    deriveHornThread(document, "map1:box-61").frontierNodeIds,
    ["map1:box-62"],
  );
  assert.deepEqual(
    deriveHornThread(document, "map1:box-63").frontierNodeIds,
    ["map1:box-64", "map1:box-65"],
  );
});

test("historical slice records the calibration artifact used for geometry adoption", () => {
  assert.equal(
    document.extensions?.sourceCalibration,
    "horn-source-calibration:cct-1998:map-1:small-regions",
  );
  assert.ok(document.citations.some((citation) => citation.layer === "cartographic"));
});
