import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  projectArgument,
  projectEvidence,
  projectFrontier,
  projectTimeline,
} from "../echarts/projections.js";
import type { HornDocument } from "../types.js";
import { canonicalizeJsonText, stringifyNormalized } from "./canonical.js";
import { projectAnalyticalView } from "./projection.js";

const chineseRoom = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../maps/chinese-room-slice.horn.json", import.meta.url)),
    "utf8",
  ),
) as HornDocument;

const echartsFixture: HornDocument = {
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
  canvas: { width: 1000, height: 600, unit: "test-unit", origin: "top-left" },
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
      text: "A later response used to exercise the analytical views.",
      author: "After Horn",
      authorShort: "After Horn",
      year: 2026,
      geometry: { x: 600, y: 300, w: 240, h: 120 },
      citationIds: ["cartographic-horn"],
    },
  ],
  relations: [
    {
      id: "relation-b-a",
      kind: "supports",
      from: "claim-b",
      to: "claim-a",
      label: "supported by",
      route: {
        commands: [
          { op: "M", x: 600, y: 360 },
          { op: "L", x: 300, y: 150 },
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
  return series[0] as GraphSeries;
}

test("argument projection matches ECharts identity and center facts without routes", () => {
  const before = structuredClone(echartsFixture);
  const projection = projectAnalyticalView(echartsFixture, "argument");
  const series = firstSeries(projectArgument(echartsFixture));
  const analysis = projection.extensions["x-analysis"] as {
    placed: Array<{ id: string; center: { x: number; y: number } }>;
    edges: Array<{ id: string }>;
  };

  assert.equal(projection.version, "horn-projection/0.1");
  assert.equal(projection.target, "argument");
  assert.deepEqual(
    analysis.placed.map((node) => ({ id: node.id, ...node.center })),
    series.data.map(({ id, x, y }) => ({ id, x, y })),
  );
  assert.equal(analysis.edges.length, series.links?.length);
  assert.equal("route" in (analysis.edges[0] ?? {}), false);
  assert.equal(JSON.stringify(projection).includes("animationDurationUpdate"), false);
  assert.deepEqual(echartsFixture, before);
});

test("timeline projection preserves chronological ECharts order", () => {
  const projection = projectAnalyticalView(echartsFixture, "timeline");
  const series = firstSeries(projectTimeline(echartsFixture));
  const dated = (
    projection.extensions["x-analysis"] as {
      datedNodes: Array<{ id: string; year: number; number: number }>;
    }
  ).datedNodes;
  assert.deepEqual(
    dated.map((node) => ({ id: node.id, value: [node.year, node.number] })),
    series.data.map(({ id, value }) => ({ id, value })),
  );
});

test("evidence projection preserves citation-to-claim bindings", () => {
  const projection = projectAnalyticalView(echartsFixture, "evidence");
  const series = firstSeries(projectEvidence(echartsFixture));
  const analysis = projection.extensions["x-analysis"] as {
    citations: Array<{ id: string }>;
    bindings: Array<{ id: string; citationId: string; nodeId: string }>;
  };
  const ids = new Set(series.data.map((item) => item.id));
  for (const citation of analysis.citations) {
    assert.ok(ids.has(`citation:${citation.id}`));
  }
  assert.equal(analysis.bindings.length, series.links?.length);
});

test("frontier projection reverses semantic response direction into reader order", () => {
  const before = structuredClone(echartsFixture);
  const projection = projectAnalyticalView(echartsFixture, "frontier");
  const series = firstSeries(projectFrontier(echartsFixture));
  const analysis = projection.extensions["x-analysis"] as {
    placed: Array<{ id: string; depth: number }>;
    readingEdges: Array<Record<string, unknown>>;
  };
  assert.deepEqual(
    analysis.placed.map((node) => ({ id: node.id, value: node.depth })),
    series.data.map(({ id, value }) => ({ id, value })),
  );
  assert.equal(analysis.readingEdges[0]?.from, "claim-a");
  assert.equal(analysis.readingEdges[0]?.to, "claim-b");
  assert.deepEqual(echartsFixture, before);
});

test("chinese-room analytical projections are normalized and renderer-neutral", () => {
  for (const view of ["argument", "timeline", "evidence", "frontier"] as const) {
    const text = stringifyNormalized(projectAnalyticalView(chineseRoom, view));
    assert.equal(text, stringifyNormalized(JSON.parse(text)));
    assert.equal(canonicalizeJsonText(text), JSON.stringify(JSON.parse(text)));
    assert.equal(text.includes("animationDurationUpdate"), false);
    assert.equal(text.includes("symbolSize"), false);
  }
});
