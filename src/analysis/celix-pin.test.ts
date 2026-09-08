import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pinPath = fileURLToPath(new URL("../../native/celix-pin.json", import.meta.url));
const pin = JSON.parse(readFileSync(pinPath, "utf8")) as {
  version: string;
  interpretationBoundary: string;
  celix: { commit: string; version: string; archive: string; archiveSha256: string };
  libraries: Record<string, { version: string; archive: string; archiveSha256: string }>;
};

test("Celix pin names an exact commit rather than latest", () => {
  assert.equal(pin.version, "horn-celix-pin/0.1");
  assert.equal(pin.celix.version, "3.0.0");
  assert.equal(pin.celix.commit, "270c784d20dabd0b1f6418c7ee2195822ec9ef90");
  assert.match(pin.celix.commit, /^[0-9a-f]{40}$/);
  assert.equal(pin.celix.archive.includes("latest"), false);
  assert.equal(pin.celix.archive.includes("/master"), false);
  assert.match(pin.celix.archiveSha256, /^[0-9a-f]{64}$/);
  assert.match(pin.interpretationBoundary, /not warrant/);
});

test("Celix pin records the libraries the framework actually needs", () => {
  assert.deepEqual(Object.keys(pin.libraries).sort(), ["jansson", "libuv", "libzip", "zlib"]);
  for (const lib of Object.values(pin.libraries)) {
    assert.match(lib.archiveSha256, /^[0-9a-f]{64}$/);
    assert.ok(lib.version.length > 0);
  }
});
