# ADR 0008: Source measurements are not authored Horn geometry

## Status

Accepted.

## Context

Historical reconstruction begins from source artifacts: scans, PDF renders, photographs, and other visual evidence. Those artifacts have measurable coordinates, but their pixel coordinate systems are properties of a particular reproduction. Crop, resolution, rasterization, and page framing can all change without changing Horn's authored cartography.

The Map 1 reconstruction now has a high-resolution raster from which the visible issue-area background extents can be measured reproducibly. Promoting those pixel rectangles directly into `HornDocument.regions[].geometry` would erase the distinction between source evidence and reconstructed document geometry.

## Decision

Measured source geometry lives in a separate `horn-source-geometry/0.1` evidence layer.

A source-geometry record stores:

- the source raster dimensions and origin;
- raw pixel measurements;
- normalized `[0, 1]` measurements;
- the measurement method and confidence;
- stable semantic IDs that join the measurement to the source index.

Source measurements may be projected onto an arbitrary working canvas for analysis or reconstruction, but such a projection remains **derived** until a deliberate reconstruction step adopts it into a historical Horn document.

## Invariants

- A raster pixel coordinate is not automatically Horn document geometry.
- Raw source measurements are retained even when normalized coordinates are also stored.
- Normalization must be a scale-only transformation from the measured source rectangle.
- Source geometry must name its source raster dimensions and extraction method.
- Measurements must identify whether they describe issue areas, claim boxes, routes, landmarks, or another visual layer.
- Analytical projections may consume measured geometry without mutating it.
- Adoption into `.horn.json` requires an explicit reconstruction decision and provenance trail.
- Relation-route geometry remains unresolved until it is measured from source evidence; issue-area measurement does not justify inventing routes.

## Consequences

Horn can improve its reconstruction as better source material becomes available. Two scans of the same map can be compared in normalized space without either scan being silently treated as canonical.

The source corpus can therefore advance incrementally:

`source index -> source measurements -> reconstructed Horn document`

This makes uncertainty visible and keeps the historical mural renderer downstream of evidence rather than downstream of guesswork.
