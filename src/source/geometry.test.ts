import assert from "node:assert/strict";
import test from "node:test";

import {
  measureAndNormalizePoint,
  measureAndNormalizeRect,
  normalizeSourcePoint,
  normalizeSourceRect,
  projectNormalizedPoint,
  projectNormalizedRect,
  sourceMeasurementMatchesNormalization,
  sourcePointMeasurementMatchesNormalization,
} from "./geometry";

const map1Raster = { width: 8259, height: 5191 };

test("normalizes measured Map 1 issue-area pixels without changing their meaning", () => {
  const normalized = normalizeSourceRect(
    { x: 1737, y: 1404, w: 1560, h: 2943 },
    map1Raster,
  );

  assert.ok(Math.abs(normalized.x - 0.210316) < 1e-6);
  assert.ok(Math.abs(normalized.y - 0.270468) < 1e-6);
  assert.ok(Math.abs(normalized.w - 0.188885) < 1e-6);
  assert.ok(Math.abs(normalized.h - 0.566943) < 1e-6);
});

test("normalizes source route points independently of HornDocument geometry", () => {
  const normalized = normalizeSourcePoint({ x: 4156, y: 2589 }, map1Raster);
  assert.ok(Math.abs(normalized.x - 0.503209) < 1e-6);
  assert.ok(Math.abs(normalized.y - 0.498748) < 1e-6);
});

test("projects normalized source geometry onto a working canvas by scale only", () => {
  const projected = projectNormalizedRect(
    { x: 0.25, y: 0.1, w: 0.5, h: 0.4 },
    { width: 2000, height: 1000 },
  );

  assert.deepEqual(projected, { x: 500, y: 100, w: 1000, h: 400 });
  assert.deepEqual(
    projectNormalizedPoint({ x: 0.25, y: 0.1 }, { width: 2000, height: 1000 }),
    { x: 500, y: 100 },
  );
});

test("checks stored normalized geometry against raw source pixels", () => {
  const measurement = measureAndNormalizeRect(
    { x: 6465, y: 111, w: 1719, h: 2456 },
    map1Raster,
  );

  assert.equal(
    sourceMeasurementMatchesNormalization(measurement, map1Raster),
    true,
  );

  const point = measureAndNormalizePoint({ x: 4347, y: 3466 }, map1Raster);
  assert.equal(sourcePointMeasurementMatchesNormalization(point, map1Raster), true);
});

test("rejects invalid source or target dimensions", () => {
  assert.throws(
    () => normalizeSourceRect({ x: 0, y: 0, w: 1, h: 1 }, { width: 0, height: 1 }),
    /source raster dimensions must be positive/,
  );
  assert.throws(
    () => normalizeSourcePoint({ x: 0, y: 0 }, { width: 1, height: 0 }),
    /source raster dimensions must be positive/,
  );
  assert.throws(
    () => projectNormalizedRect({ x: 0, y: 0, w: 1, h: 1 }, { width: 1, height: 0 }),
    /target canvas dimensions must be positive/,
  );
});
