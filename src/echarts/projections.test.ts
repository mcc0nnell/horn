import assert from "node:assert/strict";
import test from "node:test";

import type { HornDocument } from "../types";
import {
  projectArgument,
  projectEvidence,
  projectHornDocument,
  projectTimeline,
} from "./projections";

const fixture: HornDocument = {
  id: "horn:test:echarts",
  version: "horn-document/0.1",
  vocabulary: ["argumentation"],
  unitSize: "concept-diagram",
  authority: "authored",
  after: {
    name: "Robert E. Horn",
    works: ["Mapping Great Debates: Can Computers Think? (1998)"],
  },
  title: "Projection fixture",
  subtitle: "Derived analytical views",
  issueQuestion: "Can a Horn document have multiple analytical views?",
  canvas: {
    width: 1000,
    height: 600,
    unit: "test-unit",
    origin: "top-left",
  },
  regions: [],
  nodes: [
    {
      id: "claim-a",
      number: 1,
      kind: "claim",
      origin: "debate",
      focus: true,
      label: "Claim A",
      text: "A dated debate claim.",
      author: "A. Author",
      authorShort: "Author",
      year: 1950,
      geometry: { x: 100, y: 100, w: 200, h: 100 },
      citationIds: ["mapped-a"],
    },
    {
      id: "claim-b",
      number: 2,
      kind: "gloss",
      origin: "authored",
      label: "Claim B",
      text: "An authored cartographic gloss.",
      author: "After Horn",
      authorShort: "After Horn",
      year: 2026,
      geometry: { x: 600, y: 300, w: 240, h: 120 },
      citationIds: ["cartographic-horn"],
    },
  ],
  relations: [
    {
      id: "relation-a-b",
      kind: "supports",
      from: "claim-a",
      to: "claim-b",
      label: "supported by",
      route: {
        commands: [
          { op: "M", x: 300, y: 150 },
          { op: "L", x: 600, y: 360 },
        ],
      },
    },
  ],
  citations: [
    {
      id: "mapped-a",
      layer: "mapped",
      citation: "A. Author, Example Work",
      short: "Author 1950",
      year: 1950,
    },
    {
      id: "cartographic-horn",
      layer: "cartographic",
      citation: "Robert E. Horn, Mapping Great Debates",
      short: "Horn 1998",
      year: 1998,
    },
  ],
  readingPath: ["claim-a", "claim-b"],
  rights: "test fixture",
};

type GraphSeries = {
  data: Array<{ id: string; x?: number; y?: number; value?: unknown }>;
  links?: Array<Record<string, unknown>>;
};

function firstSeries(option: unknown): GraphSeries {
  const series = (option as { series: GraphSeries[] }).series;
  assert.ok(Array.isArray(series));
  assert.ok(series[0]);
  return series[0];
}

test("argument projection uses authored node centers without copying route geometry", () => {
  const before = structuredClone(fixture);
  const series = firstSeries(projectArgument(fixture));

  assert.deepEqual(
    series.data.map(({ id, x, y }) => ({ id, x, y })),
    [
      { id: "claim-a", x: 200, y: 150 },
      { id: "claim-b", x: 720, y: 360 },
    ],
  );
  assert.equal(series.links?.length, 1);
  assert.equal("route" in (series.links?.[0] ?? {}), false);
  assert.deepEqual(fixture, before);
});

test("timeline projection is chronological and keeps document claim numbers", () => {
  const series = firstSeries(projectTimeline(fixture));

  assert.deepEqual(
    series.data.map(({ id, value }) => ({ id, value })),
    [
      { id: "claim-a", value: [1950, 1] },
      { id: "claim-b", value: [2026, 2] },
    ],
  );
});

test("evidence projection creates source and claim nodes without changing the document", () => {
  const before = structuredClone(fixture);
  const series = firstSeries(projectEvidence(fixture));
  const ids = new Set(series.data.map((item) => item.id));

  assert.ok(ids.has("node:claim-a"));
  assert.ok(ids.has("node:claim-b"));
  assert.ok(ids.has("citation:mapped-a"));
  assert.ok(ids.has("citation:cartographic-horn"));
  assert.equal(series.links?.length, 2);
  assert.deepEqual(fixture, before);
});

test("projection bundle exposes argument, timeline, and evidence views", () => {
  const projections = projectHornDocument(fixture);

  assert.deepEqual(Object.keys(projections), ["argument", "timeline", "evidence"]);
  assert.equal(projections.argument.id, "argument");
  assert.equal(projections.timeline.id, "timeline");
  assert.equal(projections.evidence.id, "evidence");
});
