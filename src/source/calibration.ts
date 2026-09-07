import type { RelationKind } from "../types";
import {
  sourceMeasurementMatchesNormalization,
  sourcePointMeasurementMatchesNormalization,
  type SourceMeasuredPoint,
  type SourceMeasuredRect,
  type SourceRaster,
} from "./geometry";

export type HornSourceCalibrationNode = {
  id: string;
  issueAreaId: string;
  boxNumber: number;
  role: "focus" | "response";
  label: string;
  geometry: SourceMeasuredRect & { confidence: "high" | "medium" | "low" };
};

export type HornSourceCalibrationRelation = {
  id: string;
  kind: RelationKind;
  semantic: {
    fromBoxNumber: number;
    toBoxNumber: number;
  };
  reading: {
    fromBoxNumber: number;
    toBoxNumber: number;
    label: string;
    route: SourceMeasuredPoint[];
    confidence: "high" | "medium" | "low";
  };
};

export type HornSourceCalibrationSlice = {
  coordinateSystem: {
    pixelWidth: number;
    pixelHeight: number;
  };
  nodes: HornSourceCalibrationNode[];
  relations: HornSourceCalibrationRelation[];
};

export type HornSourceCalibrationIssue = {
  code: string;
  message: string;
};

export function validateSourceCalibrationSlice(
  slice: HornSourceCalibrationSlice,
): HornSourceCalibrationIssue[] {
  const issues: HornSourceCalibrationIssue[] = [];
  const raster: SourceRaster = {
    width: slice.coordinateSystem.pixelWidth,
    height: slice.coordinateSystem.pixelHeight,
  };

  if (raster.width <= 0 || raster.height <= 0) {
    issues.push({
      code: "invalid-raster",
      message: "Calibration source raster dimensions must be positive",
    });
    return issues;
  }

  const boxNumbers = new Set<number>();
  for (const node of slice.nodes) {
    if (boxNumbers.has(node.boxNumber)) {
      issues.push({
        code: "duplicate-box-number",
        message: `Duplicate source box number ${node.boxNumber}`,
      });
    }
    boxNumbers.add(node.boxNumber);

    if (!sourceMeasurementMatchesNormalization(node.geometry, raster)) {
      issues.push({
        code: "node-normalization-drift",
        message: `Source box ${node.boxNumber} normalized geometry does not match its raster pixels`,
      });
    }
  }

  const relationIds = new Set<string>();
  for (const relation of slice.relations) {
    if (relationIds.has(relation.id)) {
      issues.push({
        code: "duplicate-relation-id",
        message: `Duplicate source relation id ${relation.id}`,
      });
    }
    relationIds.add(relation.id);

    if (
      !boxNumbers.has(relation.semantic.fromBoxNumber) ||
      !boxNumbers.has(relation.semantic.toBoxNumber)
    ) {
      issues.push({
        code: "dangling-semantic-relation",
        message: `Source relation ${relation.id} has an endpoint outside the calibration slice`,
      });
    }

    if (
      relation.reading.fromBoxNumber !== relation.semantic.toBoxNumber ||
      relation.reading.toBoxNumber !== relation.semantic.fromBoxNumber
    ) {
      issues.push({
        code: "direction-mismatch",
        message: `Source relation ${relation.id} reading direction must reverse semantic response direction`,
      });
    }

    if (relation.reading.route.length < 2) {
      issues.push({
        code: "route-too-short",
        message: `Source relation ${relation.id} needs at least two measured route points`,
      });
    }

    relation.reading.route.forEach((point, index) => {
      if (!sourcePointMeasurementMatchesNormalization(point, raster)) {
        issues.push({
          code: "route-normalization-drift",
          message: `Source relation ${relation.id} route point ${index} does not match its raster pixels`,
        });
      }
    });
  }

  return issues;
}

export function assertValidSourceCalibrationSlice<T extends HornSourceCalibrationSlice>(
  slice: T,
): T {
  const issues = validateSourceCalibrationSlice(slice);
  if (issues.length > 0) {
    throw new Error(
      `Horn source calibration failed validation:\n${issues
        .map((issue) => `${issue.code}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  return slice;
}
