import assert from "node:assert/strict";
import test from "node:test";

import { forwardReadonlyProperty } from "./controller-state";

test("forwarded controller getters stay live after object spread", () => {
  let claimId = "c1";
  let streamId: string | undefined;
  const source = {
    get claimId() {
      return claimId;
    },
    get streamId() {
      return streamId;
    },
  };

  const decorated = { ...source };
  assert.equal(decorated.claimId, "c1");
  assert.equal(decorated.streamId, undefined);

  claimId = "c2";
  streamId = "s1";
  assert.equal(decorated.claimId, "c1");
  assert.equal(decorated.streamId, undefined);

  forwardReadonlyProperty(decorated, source, "claimId");
  forwardReadonlyProperty(decorated, source, "streamId");
  assert.equal(decorated.claimId, "c2");
  assert.equal(decorated.streamId, "s1");

  claimId = "c3";
  streamId = "s2";
  assert.equal(decorated.claimId, "c3");
  assert.equal(decorated.streamId, "s2");
});
