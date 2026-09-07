# CCT 1998 Map 1 — source measurement pass

## Status

Issue-area extents are measured for all eleven Map 1 issue areas. A first claim-box/route calibration slice is also measured for the three small issue areas rooted at boxes 59, 61, and 63.

Larger issue areas, complete claim coverage, full historical arrow shapes, landmarks, and suppressed cross-links remain unresolved.

## Source raster

The current Map 1 source raster used for measurement is 8259 × 5191 pixels with a top-left origin.

The issue-area background uses a visually stable light-blue fill in this rendering. Measuring connected components of that fill produces eleven large components that correspond to the eleven source-confirmed Map 1 issue areas in `cct-1998-map1-index.json`.

The raw and normalized issue-area measurements are stored in `corpus/cct-1998-map1-geometry.json`.

## Small-region calibration slice

`corpus/cct-1998-map1-calibration-slice.json` is the first finer-grained source calibration artifact. It covers:

- box 59, **The heads-in-the-sand objection**, and box 60, **The transmigration consolation**;
- box 61, **The theological objection**, and box 62, **The theological objection is ungrounded**;
- box 63, **Computers can't add, much less think**, box 64, **Computers can learn to add**, and box 65, **The marijuana-sniffing dog**.

For these seven boxes the slice records source rectangles, attribution metadata, semantic relation direction, reader-facing direction, and measured road-centerline approximations.

The source topology in the slice is:

- 60 disputes 59 semantically; the map reads 59 -> 60;
- 62 disputes 61 semantically; the map reads 61 -> 62;
- 64 disputes 63 semantically; the map reads 63 -> 64;
- 65 supports 63 semantically; the map reads 63 -> 65.

Incoming roads from earlier map context remain open boundaries and are not assigned to outside claims by the calibration artifact.

## Measurement method

Issue areas are measured from connected components of the light-blue issue-area fill.

Claim boxes use their visible outer rectangular extent. For the calibration slice, heavy blue focus borders and thin black response borders were measured separately from the relation roads rather than taking a naive connected-component bounding box.

That distinction matters most where the focus border merges into a road. The arithmetic focus, for example, shares blue pixels with the lower support road; its node rectangle is the visible rectangular border, not the bounding box of the entire connected blue component.

Relation roads are stored as **centerline approximations**. Straight roads use measured horizontal centerlines. The box 63 -> 65 support road uses a short polyline through its visible bend. These measurements intentionally do not claim to reconstruct starburst relation labels, full arrow polygons, or arrowhead geometry.

## Reconstruction order

1. issue-area semantic index — complete for Map 1
2. issue-area source geometry — complete for the current raster
3. focus-box identities — complete for Map 1
4. small-region focus/response box geometry — complete for boxes 59–65
5. small-region semantic/reading edges — complete for the four local relations among boxes 59–65
6. small-region road centerlines — measured with medium confidence
7. remaining claim-box identities and summaries — partial/source text available
8. remaining claim-box source geometry — unresolved
9. complete historical reading routes — unresolved
10. suppressed cross-links from box notes — unresolved
11. landmarks/illustrations — unresolved

## Adoption boundary

The measurements in the source corpus are evidence, not `HornNode.geometry`, `HornRegion.geometry`, or `HornRelation.route`.

`src/source/geometry.ts` verifies pixel/normalized coordinate consistency. `src/source/calibration.ts` additionally verifies that source relations have valid endpoints and that reader-facing direction reverses semantic response direction.

See ADR 0008 and ADR 0009.

A later reconstruction step may choose a Horn canvas, project this calibrated geometry into it, and explicitly adopt it with provenance. No such historical-document adoption is made by this measurement pass.
