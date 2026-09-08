import assert from "node:assert/strict";
import test from "node:test";

import type { HornArgument } from "../argument";
import {
  listHornArgumentStreams,
  projectHornArgumentMap,
  type HornArgumentProjectionBundle,
} from "./argument-bundle";

const argument: HornArgument = {
  id: "example",
  version: "horn-argument/0.1",
  title: "Example",
  issueQuestion: "Can it think?",
  issueType: "fact",
  sources: [],
  claims: [
    { id: "c1", role: "position", statement: "Yes", sourceIds: [], extensions: { boxNumber: 1 } },
    { id: "c2", role: "rebuttal", statement: "No", sourceIds: [], extensions: { boxNumber: 2 } },
    { id: "c3", role: "grounds", statement: "Maybe", sourceIds: [], extensions: { boxNumber: 3 } },
  ],
  relations: [
    { id: "r1", kind: "disputes", from: "c2", to: "c1" },
    { id: "r2", kind: "supports", from: "c3", to: "c1" },
  ],
  focusClaimId: "c1",
  streams: [
    {
      id: "s1",
      title: "Objection",
      focusClaimId: "c1",
      claimIds: ["c1", "c2"],
      extensions: { sourceRegionId: "map1:objection" },
    },
    { id: "s2", title: "Support", focusClaimId: "c1", claimIds: ["c1", "c3"] },
  ],
};

const bundle: HornArgumentProjectionBundle = {
  version: "horn-echarts-argument-bundle/0.1",
  argument,
  sourceLayout: {
    kind: "source-measurement",
    authority: "analytical-hint-only",
    canvas: { width: 100, height: 100, origin: "top-left", unit: "px" },
    nodes: [
      { id: "c1", number: 1, bbox: { x: 10, y: 10, w: 10, h: 10 }, provenance: "source-measurement" },
      { id: "c2", number: 2, bbox: { x: 70, y: 70, w: 10, h: 10 }, provenance: "source-measurement" },
      { id: "c3", number: 3, bbox: { x: 30, y: 40, w: 10, h: 10 }, provenance: "source-measurement" },
    ],
    regions: [
      {
        id: "map1:objection",
        label: "Objection",
        geometry: { x: 60, y: 60, w: 30, h: 30 },
        provenance: "measured-source-raster",
      },
    ],
    note: "not cartography",
  },
};

test("source measurements select deterministic no-layout ECharts projection", () => {
  const option = projectHornArgumentMap(bundle);
  const series = Array.isArray(option.series) ? option.series[0] : undefined;
  assert.equal(series?.type, "graph");
  assert.equal((series as { layout?: string }).layout, "none");
  assert.equal((series as { preserveAspect?: string }).preserveAspect, "contain");
});

test("stream selection filters the analytical graph without changing the argument", () => {
  const option = projectHornArgumentMap(bundle, { streamId: "s1" });
  const series = Array.isArray(option.series) ? option.series[0] : undefined;
  const data = (series as { data?: Array<{ id?: string }> }).data ?? [];
  const links = (series as { links?: Array<{ id?: string }> }).links ?? [];
  assert.deepEqual(data.map((item) => item.id), ["c1", "c2"]);
  assert.deepEqual(links.map((item) => item.id), ["r1"]);
  assert.equal(argument.claims.length, 3);
  assert.equal(argument.relations.length, 2);
});

test("stream summaries expose measured source-region identity for cockpit navigation", () => {
  assert.deepEqual(listHornArgumentStreams(bundle), [
    { id: "s1", title: "Objection", claimCount: 2, sourceRegionId: "map1:objection" },
    { id: "s2", title: "Support", claimCount: 2 },
  ]);
});

test("unknown stream selection fails closed", () => {
  assert.throws(
    () => projectHornArgumentMap(bundle, { streamId: "missing" }),
    /unknown Horn argument stream: missing/,
  );
});
