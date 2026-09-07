import type { Point, Rect } from "../types";

export type SourceRaster = {
  width: number;
  height: number;
};

export type SourceMeasuredRect = {
  pixels: Rect;
  normalized: Rect;
};

export type SourceMeasuredPoint = {
  pixels: Point;
  normalized: Point;
};

function assertSourceRaster(raster: SourceRaster): void {
  if (raster.width <= 0 || raster.height <= 0) {
    throw new Error("source raster dimensions must be positive");
  }
}

function assertTargetCanvas(canvas: { width: number; height: number }): void {
  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error("target canvas dimensions must be positive");
  }
}

export function normalizeSourcePoint(point: Point, raster: SourceRaster): Point {
  assertSourceRaster(raster);
  return {
    x: point.x / raster.width,
    y: point.y / raster.height,
  };
}

export function normalizeSourceRect(rect: Rect, raster: SourceRaster): Rect {
  assertSourceRaster(raster);

  return {
    x: rect.x / raster.width,
    y: rect.y / raster.height,
    w: rect.w / raster.width,
    h: rect.h / raster.height,
  };
}

export function projectNormalizedPoint(
  point: Point,
  canvas: { width: number; height: number },
): Point {
  assertTargetCanvas(canvas);
  return {
    x: point.x * canvas.width,
    y: point.y * canvas.height,
  };
}

export function projectNormalizedRect(
  rect: Rect,
  canvas: { width: number; height: number },
): Rect {
  assertTargetCanvas(canvas);

  return {
    x: rect.x * canvas.width,
    y: rect.y * canvas.height,
    w: rect.w * canvas.width,
    h: rect.h * canvas.height,
  };
}

export function measureAndNormalizePoint(
  pixels: Point,
  raster: SourceRaster,
): SourceMeasuredPoint {
  return {
    pixels: { ...pixels },
    normalized: normalizeSourcePoint(pixels, raster),
  };
}

export function measureAndNormalizeRect(
  pixels: Rect,
  raster: SourceRaster,
): SourceMeasuredRect {
  return {
    pixels: { ...pixels },
    normalized: normalizeSourceRect(pixels, raster),
  };
}

export function sourcePointMeasurementMatchesNormalization(
  measurement: SourceMeasuredPoint,
  raster: SourceRaster,
  epsilon = 1e-6,
): boolean {
  const expected = normalizeSourcePoint(measurement.pixels, raster);
  return (["x", "y"] as const).every(
    (key) => Math.abs(expected[key] - measurement.normalized[key]) <= epsilon,
  );
}

export function sourceMeasurementMatchesNormalization(
  measurement: SourceMeasuredRect,
  raster: SourceRaster,
  epsilon = 1e-6,
): boolean {
  const expected = normalizeSourceRect(measurement.pixels, raster);
  return (["x", "y", "w", "h"] as const).every(
    (key) => Math.abs(expected[key] - measurement.normalized[key]) <= epsilon,
  );
}
