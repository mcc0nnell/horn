import assert from "node:assert/strict";
import test from "node:test";

import {
  HORN_TAPE_PLAN_VERSION,
  recordHornTape,
  verifyHornTape,
  type HornTapePlan,
} from "./tape";
import type { HornDocument } from "./types";

const doc: HornDocument = {
  id: "specimen",
  version: "horn-document/0.1",
  vocabulary: [],
  unitSize: "concept-diagram",
  authority: "authored",
  title: "Specimen",
  subtitle: "",
  issueQuestion: "Can it replay?",
  canvas: { width: 100, height: 100, unit: "px", origin: "top-left" },
  regions: [],
  nodes: [
    {
      id: "q",
      number: 1,
      kind: "question",
      origin: "authored",
      label: "Q",
      text: "Question",
      geometry: { x: 0, y: 0, w: 1, h: 1 },
      citationIds: [],
    },
    {
      id: "a",
      number: 2,
      kind: "claim",
      origin: "authored",
      label: "A",
      text: "Answer",
      geometry: { x: 0, y: 0, w: 1, h: 1 },
      citationIds: [],
    },
    {
      id: "r",
      number: 3,
      kind: "rebuttal",
      origin: "authored",
      label: "R",
      text: "Rebuttal",
      geometry: { x: 0, y: 0, w: 1, h: 1 },
      citationIds: ["c1"],
    },
  ],
  relations: [
    {
      id: "rel-a",
      kind: "addresses",
      from: "a",
      to: "q",
      label: "addresses",
    },
    {
      id: "rel-r",
      kind: "disputes",
      from: "r",
      to: "a",
      label: "disputes",
    },
  ],
  citations: [
    {
      id: "c1",
      layer: "mapped",
      citation: "Source",
      short: "Source",
      year: 1998,
    },
  ],
  readingPath: ["q", "a", "r"],
  rights: "test",
};

const plan: HornTapePlan = {
  version: HORN_TAPE_PLAN_VERSION,
  actions: [
    { kind: "focus-node", nodeId: "q" },
    { kind: "follow-relation", relationId: "rel-a" },
    { kind: "follow-relation", relationId: "rel-r" },
    { kind: "open-citation", citationId: "c1" },
    { kind: "checkpoint", label: "rebuttal reached" },
  ],
};

test("records a deterministic receipt-chained reader traversal", () => {
  const first = recordHornTape(doc, plan);
  const second = recordHornTape(doc, plan);
  assert.deepEqual(first, second);
  assert.equal(first.terminal.nodeId, "r");
  assert.equal(first.events[1]?.payload.kind, "follow-relation");
  assert.equal(
    first.events[1]?.previousDigest,
    first.events[0]?.receiptDigest,
  );
  assert.match(first.id, /^horn-tape:[a-f0-9]{64}$/);
});

test("replays the tape against the same canonical Horn document", () => {
  const tape = recordHornTape(doc, plan);
  const report = verifyHornTape(doc, tape);
  assert.equal(report.valid, true);
  assert.deepEqual(report.issues, []);
  assert.equal(report.replayedEvents, plan.actions.length);
  assert.equal(report.terminalNodeId, "r");
});

test("detects event tampering", () => {
  const tape = recordHornTape(doc, plan);
  const tampered = structuredClone(tape);
  const event = tampered.events[1];
  if (!event || event.payload.kind !== "follow-relation") {
    throw new Error("expected a follow-relation event");
  }
  event.payload.relationId = "rel-r";
  const report = verifyHornTape(doc, tampered);
  assert.equal(report.valid, false);
  assert(report.issues.includes("event-2-receipt-digest-mismatch"));
  assert(report.issues.includes("event-2-semantic-replay-failed"));
  assert(report.issues.includes("tape-id-mismatch"));
});

test("binds a tape to the exact canonical source document", () => {
  const tape = recordHornTape(doc, plan);
  const changed = structuredClone(doc);
  changed.nodes[0]!.text = "Changed question";
  const report = verifyHornTape(changed, tape);
  assert.equal(report.valid, false);
  assert(report.issues.includes("source-digest-mismatch"));
  assert(report.issues.includes("genesis-digest-mismatch"));
});

test("rejects a relation followed in semantic rather than reader direction", () => {
  assert.throws(
    () =>
      recordHornTape(doc, {
        version: HORN_TAPE_PLAN_VERSION,
        actions: [
          { kind: "focus-node", nodeId: "a" },
          { kind: "follow-relation", relationId: "rel-a" },
        ],
      }),
    /not reader-followable/,
  );
});
