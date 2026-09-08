import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgumentProjectionBundle } from "./argument-bundle";
import { listHornArgumentRegions } from "./regions";

const bundle: HornArgumentProjectionBundle = {
  version: "horn-echarts-argument-bundle/0.1",
  argument: {
    id: "map1",
    version: "horn-argument/0.1",
    title: "Map 1",
    issueQuestion: "Can computers think?",
    issueType: "fact",
    sources: [],
    claims: [
      { id: "c1", role: "position", statement: "focus", sourceIds: [] },
      { id: "c2", role: "grounds", statement: "support", sourceIds: [] },
    ],
    relations: [{ id: "r1", kind: "supports", from: "c2", to: "c1" }],
    focusClaimId: "c1",
    streams: [
      {
        id: "s1",
        title: "Issue 1",
        focusClaimId: "c1",
        claimIds: ["c1", "c2"],
        extensions: { sourceRegionId: "region-1" },
      },
    ],
  },
  sourceLayout: {
    kind: "source-measurement",
    authority: "analytical-hint-only",
    canvas: { width: 100, height: 80, origin: "top-left", unit: "px" },
    nodes: [],
    regions: [
      {
        id: "region-1",
        label: "Issue 1 region",
        geometry: { x: 10, y: 20, w: 30, h: 40 },
        provenance: "measured-source-raster",
      },
      {
        id: "region-unmapped",
        label: "Unmapped",
        geometry: { x: 1, y: 2, w: 3, h: 4 },
        provenance: "measured-source-raster",
      },
    ],
    note: "measurement only",
  },
};

test("measured regions stay projection-only and resolve streams", () => {
  const regions = listHornArgumentRegions(bundle);
  assert.deepEqual(regions, [
    {
      id: "region-1",
      label: "Issue 1 region",
      geometry: { x: 10, y: 20, w: 30, h: 40 },
      streamIds: ["s1"],
    },
    {
      id: "region-unmapped",
      label: "Unmapped",
      geometry: { x: 1, y: 2, w: 3, h: 4 },
      streamIds: [],
    },
  ]);
});
