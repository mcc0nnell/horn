# ADR 0009: Source calibration precedes historical Horn documents

## Status

Accepted.

## Context

The Map 1 reconstruction now has three distinct forms of spatial data:

1. the source raster itself;
2. measured source evidence such as issue-area extents, claim-box rectangles, and relation-road centerlines;
3. canonical geometry that may eventually appear in a historical `HornDocument`.

It is tempting to skip directly from a measured rectangle to `HornNode.geometry`, especially when a source raster is high resolution. That would erase the distinction between a measurement made from one reproduction and geometry deliberately adopted as the reconstruction's canonical historical coordinate system.

The first small-region calibration slice covers boxes 59–65. It also demonstrates that relation direction has two simultaneous meanings: semantic response direction and historical reading direction.

## Decision

Historical reconstruction proceeds through an explicit **source calibration** stage.

A source calibration slice may record:

- source box identity and role;
- attribution metadata;
- measured raster rectangles;
- normalized source rectangles;
- semantic relation endpoints;
- reader-facing relation endpoints;
- measured or approximated relation-road centerlines;
- confidence and unresolved boundary conditions.

Source calibration data is evidence. It is not a `HornDocument` and cannot be rendered as though it were adopted historical geometry.

`src/source/calibration.ts` validates calibration invariants before any later promotion step is allowed.

## Direction invariant

For a dialectical response in the calibration corpus:

`semantic.from == reading.to`

and

`semantic.to == reading.from`

The semantic edge identifies what the later claim supports or disputes. The reading edge follows Horn's reader-facing progression from the earlier claim to its response.

## Geometry invariant

Every normalized source rectangle and route point must recompute from its raw raster pixels within the calibration tolerance. A stored normalized coordinate is never an independent source of truth.

Measured road centerlines may carry lower confidence than box rectangles. Centerline measurements do not imply that the full historical arrow shape, label geometry, or arrowhead has been reconstructed.

## Promotion gate

A calibration slice may be promoted into a historical Horn reconstruction only through a separate, explicit operation that:

1. identifies the calibration artifact used;
2. chooses the Horn canvas coordinate system;
3. projects or otherwise adopts source geometry intentionally;
4. records provenance for the adopted geometry;
5. preserves unresolved or low-confidence source evidence rather than silently filling it in.

There is no implicit calibration-to-document round trip.

## Consequences

The project can measure aggressively without claiming too much. Better scans can replace or refine source evidence without silently rewriting adopted historical documents. The same calibration artifact can also support overlays, ECharts comparison views, or regression checks without becoming the knowledge model itself.
