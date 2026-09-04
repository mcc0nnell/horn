import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { HornArgument } from "./argument";
import { validateHornArgument } from "./argument";
import { validateArgumentCartography } from "./correspondence";
import type { HornDocument } from "./types";
import { validateHornDocument } from "./validate";

const argument = JSON.parse(
  readFileSync(new URL("../arguments/chinese-room.horn-argument.json", import.meta.url), "utf8"),
) as HornArgument;

const document = JSON.parse(
  readFileSync(new URL("../maps/chinese-room-slice.horn.json", import.meta.url), "utf8"),
) as HornDocument;

test("Chinese Room semantic argument is internally valid", () => {
  assert.deepEqual(validateHornArgument(argument), []);
});

test("Chinese Room cartographic document remains valid", () => {
  assert.deepEqual(validateHornDocument(document), []);
});

test("Chinese Room mural realizes the semantic argument without changing identities", () => {
  assert.deepEqual(validateArgumentCartography(argument, document), []);
});

test("authored cartographic overlays do not become semantic claims", () => {
  assert.equal(argument.claims.some((claim) => claim.id === "a1-stable-argumentation"), false);
  assert.equal(document.nodes.some((node) => node.id === "a1-stable-argumentation"), true);
});
