import assert from "node:assert/strict";
import test from "node:test";

import {
  hornNodeUrl,
  hornViewUrl,
  parseHornAddress,
} from "./address";

test("parses a semantic node entry point", () => {
  assert.deepEqual(parseHornAddress("?node=c5-chinese-room"), {
    kind: "node",
    nodeId: "c5-chinese-room",
  });
});

test("node entry point wins over an exact camera view", () => {
  assert.deepEqual(
    parseHornAddress("?view=1,2,300,150&node=c7-systems-reply"),
    { kind: "node", nodeId: "c7-systems-reply" },
  );
});

test("parses an exact camera view", () => {
  assert.deepEqual(parseHornAddress("?view=12.5,20,400,200"), {
    kind: "view",
    viewBox: { x: 12.5, y: 20, width: 400, height: 200 },
  });
});

test("malformed or non-positive camera views fall back to the full mural", () => {
  assert.deepEqual(parseHornAddress("?view=1,2,-3,4"), { kind: "full" });
  assert.deepEqual(parseHornAddress("?view=wat,2,3,4"), { kind: "full" });
  assert.deepEqual(parseHornAddress("?view=1,2,3"), { kind: "full" });
});

test("builds node URLs without carrying a stale exact view", () => {
  const url = hornNodeUrl(
    "https://example.test/horn?view=1,2,3,4&mode=read",
    "c5-chinese-room",
  );
  assert.equal(url.searchParams.get("node"), "c5-chinese-room");
  assert.equal(url.searchParams.get("view"), null);
  assert.equal(url.searchParams.get("mode"), "read");
});

test("builds compact exact-view URLs without carrying a stale node", () => {
  const url = hornViewUrl(
    "https://example.test/horn?node=c1&mode=read",
    { x: 12.34567, y: 20, width: 400.1254, height: 200 },
  );
  assert.equal(url.searchParams.get("node"), null);
  assert.equal(url.searchParams.get("view"), "12.346,20,400.125,200");
  assert.equal(url.searchParams.get("mode"), "read");
});
