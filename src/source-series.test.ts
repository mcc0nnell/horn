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

test("CCT calibration is the complete seven-map normalized mirror set", () => {
  const series = loadSeries();

  assert.equal(series.id, "cct-1998");
  assert.equal(series.sourceRepository.repository, "mcc0nnell/web");
  assert.equal(series.sourceRepository.ref, "main");
  assert.deepEqual(series.maps.map((entry) => entry.map), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(series.maps.length, 7);
  assert.ok(series.maps.every((entry) => entry.path.startsWith("public/horn/maps/")));
  assert.ok(series.maps.every((entry) => entry.aliases?.some((path) => path.startsWith("docs/"))));
});

test("CCT map source identities are unique and immutable-shaped", () => {
  const series = loadSeries();
  const blobIds = series.maps.map((entry) => entry.gitBlobSha1);

  assert.equal(new Set(blobIds).size, 7);
  assert.ok(blobIds.every((sha) => /^[0-9a-f]{40}$/.test(sha)));
  assert.equal(series.maps[3]?.relatedSource?.gitBlobSha1, "373e4fa3b6e8acf0cd93cd2552fe9d2031a16313");
  assert.equal(
    series.companionSources[0]?.gitBlobSha1,
    "c176591977cc06bc45e763447ea883006b5b0520e",
  );
});

test("source-series validation accepts archived and normalized roots", () => {
  const series = loadSeries();
  const archived = structuredClone(series) as HornSourceSeries;
  archived.maps[0]!.path = archived.maps[0]!.aliases![0]!;

  assert.deepEqual(validateHornSourceSeries(archived), []);
});

test("source-series validation refuses paths outside registered source roots", () => {
  const series = loadSeries();
  const mutated = structuredClone(series) as HornSourceSeries;
  mutated.maps[0]!.path = "tmp/01-can-computers-think.pdf";

  const issues = validateHornSourceSeries(mutated);
  assert.ok(issues.some((issue) => issue.code === "source-outside-registry-roots"));
});
