# CCT 1998 Map 1 — source measurement pass

## Status

Issue-area extents measured. Claim boxes, focus-box rectangles, landmarks, and relation routes remain unresolved.

## Source raster

The current Map 1 source raster used for measurement is 8259 × 5191 pixels with a top-left origin.

The issue-area background uses a visually stable light-blue fill in this rendering. Measuring connected components of that fill produces eleven large components that correspond to the eleven source-confirmed Map 1 issue areas in `cct-1998-map1-index.json`.

The raw and normalized measurements are stored in `corpus/cct-1998-map1-geometry.json`.

## Why issue areas first

The issue-area fills are large, visually continuous, and separable in the raster. Their extents can therefore be measured without interpreting claim text or inventing missing boundaries.

This gives the reconstruction a source-backed spatial scaffold while preserving uncertainty about finer layers.

## Why focus boxes are not measured yet

The focus-box styling is visually identifiable, but the heavy blue focus borders often connect directly into Horn's road/spine graphics. In the source raster those blue pixels can form one connected component containing a focus box, arrows, and long portions of a dialogue thread.

For example, the free-will focus box is visually distinct to a reader, but its border participates in the long blue thread spine. A naive connected-component bounding box therefore measures the spine rather than just the focus box.

Focus-box *identity* is already source-backed by the handbook rule and the map's box numbers. Focus-box *geometry* will remain unresolved until it can be measured with a method that separates cartographic road geometry from box borders reliably.

## Reconstruction order

1. issue-area semantic index — complete for Map 1
2. issue-area source geometry — complete for the current raster
3. focus-box identities — complete for Map 1
4. focus-box source geometry — unresolved
5. claim-box identities and summaries — partial/source text available, not yet reconstructed as a complete map corpus
6. claim-box source geometry — unresolved
7. semantic response edges — partial, to be reconstructed from map content and notes
8. historical reading routes — unresolved
9. suppressed cross-links from box notes — unresolved
10. landmarks/illustrations — unresolved

## Adoption boundary

The rectangles in the source-geometry file are evidence measurements, not `HornDocument.regions[].geometry`. See ADR 0008.

A later reconstruction step may project normalized source measurements onto a Horn canvas, compare them against other source reproductions, and then explicitly adopt a chosen geometry with provenance. No such adoption is made by this pass.
