import assert from "node:assert/strict";
import test from "node:test";

import type { HornDocument } from "./types";
import { deriveHornThread } from "./structure";

const document: HornDocument = {
  id: "horn:test:thread",
  version: "horn-document/0.1",
  vocabulary: ["argumentation"],
  unitSize: "concept-diagram",
  authority: "authored",
  after: {
    name: "Robert E. Horn",
    works: ["Mapping Great Debates: Can Computers Think? (1998)"],
  },
  title: "Thread fixture",
  subtitle: "Reader order versus semantic direction",
  issueQuestion: "How do Horn dialogue threads grow?",
  canvas: { width: 1000, height: 600, unit: "test", origin: "top-left" },
  regions: [],
  nodes: [
    {
      id: "focus",
      number: 1,
      kind: "focus-claim",
      origin: "debate",
      focus: true,
      label: "Focus",
      text: "Focus claim",
      geometry: { x: 100, y: 100, w: 100, h: 80 },
      citationIds: ["mapped"],
    },
    {
      id: "reply-a",
      number: 2,
      kind: "rebuttal",
      origin: "debate",
      label: "Reply A",
      text: "First response",
      geometry: { x: 300, y: 80, w: 100, h: 80 },
      citationIds: ["mapped"],
    },
    {
      id: "reply-b",
      number: 3,
      kind: "grounds",
      origin: "debate",
      label: "Reply B",
      text: "Second response",
      geometry: { x: 300, y: 220, w: 100, h: 80 },
      citationIds: ["mapped"],
    },
    {
      id: "counter-a",
      number: 4,
      kind: "rebuttal",
      origin: "debate",
      label: "Counter A",
      text: "Response to reply A",
      geometry: { x: 500, y: 80, w: 100, h: 80 },
      citationIds: ["mapped"],
    },
    {
      id: "unrelated",
      number: 5,
      kind: "gloss",
      origin: "authored",
      label: "Unrelated",
      text: "Not part of the dialogue thread",
      geometry: { x: 700, y: 400, w: 100, h: 80 },
      citationIds: ["cartographic"],
    },
  ],
  relations: [
    {
      id: "reply-a-focus",
      kind: "disputes",
      from: "reply-a",
      to: "focus",
      label: "disputed by",
    },
    {
      id: "reply-b-focus",
      kind: "supports",
      from: "reply-b",
      to: "focus",
      label: "supported by",
    },
    {
      id: "counter-a-reply-a",
      kind: "disputes",
      from: "counter-a",
      to: "reply-a",
      label: "disputed by",
    },
    {
      id: "unrelated-focus",
      kind: "addresses",
      from: "unrelated",
      to: "focus",
      label: "addresses",
    },
  ],
  citations: [
    {
      id: "mapped",
      layer: "mapped",
      citation: "Mapped source",
      short: "Mapped",
      year: 1998,
    },
    {
      id: "cartographic",
      layer: "cartographic",
      citation: "Cartographic source",
      short: "Cartographic",
      year: 1998,
    },
  ],
  readingPath: ["focus", "reply-a", "counter-a", "reply-b"],
  rights: "test fixture",
};

test("walks outward from focus by reversing semantic response edges", () => {
  const structure = deriveHornThread(document, "focus");

  assert.deepEqual(
    structure.steps.map(({ nodeId, depth }) => ({ nodeId, depth })),
    [
      { nodeId: "focus", depth: 0 },
      { nodeId: "reply-a", depth: 1 },
      { nodeId: "reply-b", depth: 1 },
      { nodeId: "counter-a", depth: 2 },
    ],
  );
  assert.deepEqual(structure.frontierNodeIds, ["reply-b", "counter-a"]);
});

test("does not silently treat non-dialectical relations as dialogue edges", () => {
  const structure = deriveHornThread(document, "focus");
  assert.equal(structure.steps.some((step) => step.nodeId === "unrelated"), false);
});

test("can opt into an extension relation kind explicitly", () => {
  const structure = deriveHornThread(document, "focus", {
    relationKinds: ["supports", "disputes", "addresses"],
  });
  assert.equal(structure.steps.some((step) => step.nodeId === "unrelated"), true);
});
