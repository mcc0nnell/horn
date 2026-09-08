import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { recordHornTape, verifyHornTape, type HornTapePlan } from "./tape";
import type { HornDocument } from "./types";

type GoldenCase = {
  name: string;
  plan: HornTapePlan;
  expected: {
    documentId: string;
    terminalNodeId: string;
    eventCount: number;
    relationEvent: {
      seq: number;
      relationId: string;
      fromNodeId: string;
      toNodeId: string;
    };
  };
};

type GoldenCorpus = {
  fork: {
    left: string;
    right: string;
    sharedPrefixEvents: number;
    divergenceEvent: number;
  };
  cases: GoldenCase[];
};

const document = JSON.parse(
  readFileSync(new URL("../maps/cct-map1-small-regions.horn.json", import.meta.url), "utf8"),
) as HornDocument;
const corpus = JSON.parse(
  readFileSync(new URL("../golden/tape/cases.json", import.meta.url), "utf8"),
) as GoldenCorpus;

test("CCT Map 1 tape corpus replays deterministically in reader direction", () => {
  for (const specimen of corpus.cases) {
    const first = recordHornTape(document, specimen.plan);
    const second = recordHornTape(document, specimen.plan);

    assert.deepEqual(second, first, specimen.name);
    assert.equal(first.document.id, specimen.expected.documentId);
    assert.equal(first.terminal.nodeId, specimen.expected.terminalNodeId);
    assert.equal(first.events.length, specimen.expected.eventCount);

    const relationEvent = first.events[specimen.expected.relationEvent.seq - 1];
    assert.ok(relationEvent);
    assert.deepEqual(relationEvent.payload, {
      kind: "follow-relation",
      relationId: specimen.expected.relationEvent.relationId,
      fromNodeId: specimen.expected.relationEvent.fromNodeId,
      toNodeId: specimen.expected.relationEvent.toNodeId,
    });

    const verification = verifyHornTape(document, first);
    assert.equal(verification.valid, true);
    assert.deepEqual(verification.issues, []);
    assert.equal(verification.tapeId, first.id);
    assert.equal(verification.expectedTapeId, first.id);
    assert.equal(verification.terminalNodeId, specimen.expected.terminalNodeId);
    assert.equal(verification.replayedEvents, specimen.expected.eventCount);
  }
});

test("CCT Map 1 branch pair shares history until the exact fork receipt", () => {
  const byName = new Map(
    corpus.cases.map((specimen) => [specimen.name, recordHornTape(document, specimen.plan)]),
  );
  const left = byName.get(corpus.fork.left);
  const right = byName.get(corpus.fork.right);
  assert.ok(left);
  assert.ok(right);

  assert.equal(left.document.sha256, right.document.sha256);
  assert.equal(left.genesisDigest, right.genesisDigest);

  for (let index = 0; index < corpus.fork.sharedPrefixEvents; index += 1) {
    assert.deepEqual(left.events[index]?.payload, right.events[index]?.payload);
    assert.equal(left.events[index]?.receiptDigest, right.events[index]?.receiptDigest);
  }

  const divergenceIndex = corpus.fork.divergenceEvent - 1;
  assert.equal(
    left.events[divergenceIndex]?.previousDigest,
    right.events[divergenceIndex]?.previousDigest,
  );
  assert.notDeepEqual(
    left.events[divergenceIndex]?.payload,
    right.events[divergenceIndex]?.payload,
  );
  assert.notEqual(
    left.events[divergenceIndex]?.receiptDigest,
    right.events[divergenceIndex]?.receiptDigest,
  );
  assert.notEqual(left.terminal.digest, right.terminal.digest);
  assert.notEqual(left.id, right.id);
});
