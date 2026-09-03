import assert from "node:assert/strict";
import test from "node:test";

import type { HornDocument, HornRoute } from "../types";
import { pathCommandsToSvgD, renderHornSvg } from "./svg";

const route: HornRoute = {
  commands: [
    { op: "M", x: 20, y: 30 },
    { op: "L", x: 120, y: 30 },
    { op: "Q", x1: 150, y1: 30, x: 150, y: 60 },
    { op: "C", x1: 150, y1: 90, x2: 180, y2: 90, x: 180, y: 120 },
  ],
  labelGeometry: { x: 70, y: 15, w: 80, h: 30 },
};

function authoredDocument(withRoute: boolean): HornDocument {
  return {
    id: "horn:test:authored",
    version: "horn-document/0.1",
    vocabulary: ["argumentation"],
    unitSize: "concept-diagram",
    authority: "authored",
    after: {
      name: "Robert E. Horn",
      works: ["Mapping Great Debates: Can Computers Think? (1998)"],
    },
    title: "Renderer test",
    subtitle: "",
    issueQuestion: "Does the renderer preserve geometry?",
    canvas: { width: 400, height: 300, unit: "px", origin: "top-left" },
    regions: [],
    nodes: [
      {
        id: "claim-1",
        number: 1,
        kind: "claim",
        origin: "debate",
        focus: true,
        label: "Mapped claim",
        text: "A mapped claim.",
        geometry: { x: 20, y: 20, w: 120, h: 90 },
        citationIds: ["mapped"],
      },
      {
        id: "gloss-2",
        number: 2,
        kind: "gloss",
        origin: "authored",
        label: "Authored gloss",
        text: "An authored note.",
        geometry: { x: 180, y: 120, w: 140, h: 90 },
        citationIds: ["cartographic"],
      },
    ],
    relations: [
      {
        id: "r1",
        kind: "disputes",
        from: "gloss-2",
        to: "claim-1",
        label: "disputed by",
        ...(withRoute ? { route } : {}),
      },
    ],
    citations: [
      {
        id: "mapped",
        layer: "mapped",
        citation: "Mapped source",
        short: "Mapped",
        year: 1950,
      },
      {
        id: "cartographic",
        layer: "cartographic",
        citation: "Cartographic source",
        short: "Cartographic",
        year: 1998,
      },
    ],
    readingPath: ["claim-1", "gloss-2"],
    rights: "test",
  };
}

function historicalDocumentWithoutRoute(): HornDocument {
  return {
    id: "horn:test:historical",
    version: "horn-document/0.1",
    vocabulary: ["argumentation"],
    unitSize: "concept-diagram",
    authority: "historical",
    title: "Historical test",
    subtitle: "",
    issueQuestion: "Can history be silently rerouted?",
    canvas: { width: 400, height: 300, unit: "px", origin: "top-left" },
    regions: [],
    nodes: [
      {
        id: "claim-1",
        number: 1,
        kind: "claim",
        origin: "debate",
        label: "One",
        text: "One",
        geometry: { x: 20, y: 20, w: 120, h: 90 },
        citationIds: ["mapped"],
      },
      {
        id: "claim-2",
        number: 2,
        kind: "claim",
        origin: "debate",
        label: "Two",
        text: "Two",
        geometry: { x: 180, y: 120, w: 120, h: 90 },
        citationIds: ["mapped"],
      },
    ],
    relations: [
      {
        id: "r1",
        kind: "supports",
        from: "claim-2",
        to: "claim-1",
        label: "supported by",
      },
    ],
    citations: [
      {
        id: "mapped",
        layer: "mapped",
        citation: "Mapped source",
        short: "Mapped",
        year: 1950,
      },
      {
        id: "cartographic",
        layer: "cartographic",
        citation: "Cartographic source",
        short: "Cartographic",
        year: 1998,
      },
    ],
    readingPath: ["claim-1", "claim-2"],
    rights: "test",
  };
}

test("serializes authored path commands without changing coordinates", () => {
  assert.equal(
    pathCommandsToSvgD(route.commands),
    "M 20 30 L 120 30 Q 150 30 150 60 C 150 90 180 90 180 120",
  );
});

test("renders persisted routes and relation labels", () => {
  const result = renderHornSvg(authoredDocument(true));
  assert.deepEqual(result.warnings, []);
  assert.match(result.svg, /data-horn-relation="r1"/);
  assert.match(result.svg, /M 20 30 L 120 30 Q 150 30 150 60/);
  assert.match(result.svg, /data-horn-relation-label="r1"/);
});

test("never invents an authored relation route", () => {
  const result = renderHornSvg(authoredDocument(false));
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "unrouted-authored-relation");
  assert.doesNotMatch(result.svg, /data-horn-relation="r1"/);
});

test("refuses a historical document with missing relation geometry", () => {
  assert.throws(
    () => renderHornSvg(historicalDocumentWithoutRoute()),
    /missing-relation-geometry/,
  );
});
