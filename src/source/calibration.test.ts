import assert from "node:assert/strict";
import test from "node:test";

import type { HornSourceCalibrationSlice } from "./calibration";
import {
  assertValidSourceCalibrationSlice,
  validateSourceCalibrationSlice,
} from "./calibration";

const fixture: HornSourceCalibrationSlice = {
  coordinateSystem: { pixelWidth: 8259, pixelHeight: 5191 },
  nodes: [
    {
      id: "map1:box-59",
      issueAreaId: "map1:heads-in-the-sand",
      boxNumber: 59,
      role: "focus",
      label: "The heads-in-the-sand objection.",
      geometry: {
        pixels: { x: 3634, y: 2482, w: 522, h: 200 },
        normalized: { x: 0.440005, y: 0.478135, w: 0.063204, h: 0.038528 },
        confidence: "high",
      },
    },
    {
      id: "map1:box-60",
      issueAreaId: "map1:heads-in-the-sand",
      boxNumber: 60,
      role: "response",
      label: "The transmigration consolation.",
      geometry: {
        pixels: { x: 4313, y: 2503, w: 437, h: 170 },
        normalized: { x: 0.522218, y: 0.482181, w: 0.052912, h: 0.032749 },
        confidence: "high",
      },
    },
  ],
  relations: [
    {
      id: "map1:relation-60-59",
      kind: "disputes",
      semantic: { fromBoxNumber: 60, toBoxNumber: 59 },
      reading: {
        fromBoxNumber: 59,
        toBoxNumber: 60,
        label: "is disputed by",
        route: [
          {
            pixels: { x: 4156, y: 2589 },
            normalized: { x: 0.503209, y: 0.498748 },
          },
          {
            pixels: { x: 4313, y: 2589 },
            normalized: { x: 0.522218, y: 0.498748 },
          },
        ],
        confidence: "medium",
      },
    },
  ],
};

test("accepts a measured slice whose geometry and relation directions match source evidence", () => {
  assert.deepEqual(validateSourceCalibrationSlice(fixture), []);
  assert.equal(assertValidSourceCalibrationSlice(fixture), fixture);
});

test("rejects normalized geometry that drifts away from raw source pixels", () => {
  const changed = structuredClone(fixture);
  changed.nodes[0]!.geometry.normalized.x += 0.01;

  assert.ok(
    validateSourceCalibrationSlice(changed).some(
      (issue) => issue.code === "node-normalization-drift",
    ),
  );
});

test("rejects a reading edge that is not the reverse of semantic response direction", () => {
  const changed = structuredClone(fixture);
  changed.relations[0]!.reading.fromBoxNumber = 60;
  changed.relations[0]!.reading.toBoxNumber = 59;

  assert.ok(
    validateSourceCalibrationSlice(changed).some(
      (issue) => issue.code === "direction-mismatch",
    ),
  );
});

test("rejects route points whose normalized coordinates do not match the raster", () => {
  const changed = structuredClone(fixture);
  changed.relations[0]!.reading.route[0]!.normalized.y += 0.01;

  assert.ok(
    validateSourceCalibrationSlice(changed).some(
      (issue) => issue.code === "route-normalization-drift",
    ),
  );
});
