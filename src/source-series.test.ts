import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { HornSourceSeries } from "./source-series";
import { validateHornSourceSeries } from "./source-series";

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, "../corpus/cct-1998-series.sources.json");

function loadSeries(): HornSourceSeries {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as HornSourceSeries;
}

test("CCT 1998 source registry is structurally valid", () => {
  const series = loadSeries();
  assert.deepEqual(validateHornSourceSeries(series), []);
});

test("CCT calibration is the complete seven-map docs source set", () => {
  const series = loadSeries();

  assert.equal(series.id, "cct-1998");
  assert.equal(series.sourceRepository.repository, "mcc0nnell/web");
  assert.equal(series.sourceRepository.ref, "main");
  assert.deepEqual(series.maps.map((entry) => entry.map), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(series.maps.length, 7);
  assert.ok(series.maps.every((entry) => entry.path.startsWith("docs/")));
  assert.ok(series.companionSources.every((entry) => entry.path.startsWith("docs/")));
});

test("CCT map source identities are unique and immutable-shaped", () => {
  const series = loadSeries();
  const blobIds = series.maps.map((entry) => entry.gitBlobSha1);

  assert.equal(new Set(blobIds).size, 7);
  assert.ok(blobIds.every((sha) => /^[0-9a-f]{40}$/.test(sha)));
  assert.equal(series.maps[3]?.relatedSource?.gitBlobSha1, "373e4fa3b6e8acf0cd93cd2552fe9d2031a16313");
});

test("source-series validation refuses calibration paths outside docs", () => {
  const series = loadSeries();
  const mutated = structuredClone(series) as HornSourceSeries;
  mutated.maps[0]!.path = "public/horn/maps/01-can-computers-think.pdf";

  const issues = validateHornSourceSeries(mutated);
  assert.ok(issues.some((issue) => issue.code === "source-outside-docs"));
});
