import type { Rect } from "../types";

export type SourceRaster = {
  width: number;
  height: number;
};

export type SourceMeasuredRect = {
  pixels: Rect;
  normalized: Rect;
};

export function normalizeSourceRect(rect: Rect, raster: SourceRaster): Rect {
  if (raster.width <= 0 || raster.height <= 0) {
    throw new Error("source raster dimensions must be positive");
  }

  return {
    x: rect.x / raster.width,
    y: rect.y / raster.height,
    w: rect.w / raster.width,
    h: rect.h / raster.height,
  };
}

export function projectNormalizedRect(
  rect: Rect,
  canvas: { width: number; height: number },
): Rect {
  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error("target canvas dimensions must be positive");
  }

  return {
    x: rect.x * canvas.width,
    y: rect.y * canvas.height,
    w: rect.w * canvas.width,
    h: rect.h * canvas.height,
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
