import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderHornSvg } from "../render";
import type { HornDocument } from "../types";
import { validateHornDocument } from "../validate";

const source = readFileSync(
  new URL("../../maps/celix-845-specimen-001.horn.json", import.meta.url),
  "utf8",
);
const document = JSON.parse(source) as HornDocument;

const evidenceSource = readFileSync(
  new URL(
    "../../experiments/celix-845/evidence/sbom-physical-evidence.json",
    import.meta.url,
  ),
  "utf8",
);
const evidence = JSON.parse(evidenceSource) as {
  artifact: { headSha: string; archiveDigest: string };
  sbom: { bomFormat: string; specVersion: string; componentCount: number };
  components: Record<string, string>;
  dependencyGraph: Record<string, string[]>;
  interpretationBoundary: string;
};

test("Celix 845 authored specimen validates", () => {
  assert.deepEqual(validateHornDocument(document), []);
});

test("Celix 845 keeps mapped evidence separate from cartographic provenance", () => {
  const mapped = document.citations.filter((citation) => citation.layer === "mapped");
  const cartographic = document.citations.filter(
    (citation) => citation.layer === "cartographic",
  );

  assert.ok(mapped.length >= 10);
  assert.equal(cartographic.length, 1);
});

test("Celix 845 reconstruction does not invent supply-chain relation kinds", () => {
  const relationKinds = new Set(document.relations.map((relation) => relation.kind));
  assert.deepEqual(
    [...relationKinds].sort(),
    ["addresses", "disputes", "supports"],
  );
});

test("safe-default reference state is the focus claim", () => {
  const focusNodes = document.nodes.filter((node) => node.focus);
  assert.equal(focusNodes.length, 1);
  assert.equal(focusNodes[0]?.id, "c6-safe-default");
});

test("Celix 845 physical evidence is pinned to the specimen head", () => {
  assert.equal(
    evidence.artifact.headSha,
    "e0107b1ad30ef884ee4ebc651f046b065b2c631b",
  );
  assert.equal(
    evidence.artifact.archiveDigest,
    "sha256:7d5068822f582d87cc02715d81dbddbfb12ea819d62cb5780977140783ea3ebb",
  );
});

test("Celix 845 physical evidence records the observed CycloneDX graph", () => {
  assert.equal(evidence.sbom.bomFormat, "CycloneDX");
  assert.equal(evidence.sbom.specVersion, "1.6");
  assert.equal(evidence.sbom.componentCount, 18);
  assert.equal(evidence.components.celix, "3.0.0");
  assert.equal(evidence.components.openssl, "3.6.3");
  assert.ok(evidence.dependencyGraph.celix?.includes("libcurl"));
  assert.ok(evidence.dependencyGraph.libcurl?.includes("openssl"));
});

test("SBOM facts remain explicitly outside the normative Horn relation graph", () => {
  assert.match(evidence.interpretationBoundary, /not Horn argument relations/);
  assert.ok(
    !document.relations.some((relation) =>
      ["depends_on", "contains", "generated_from"].includes(relation.kind),
    ),
  );
});

test("Celix 845 has persisted authored geometry for every argument relation", () => {
  assert.equal(document.relations.length, 9);
  assert.ok(document.relations.every((relation) => relation.route));
  assert.match(
    String(document.extensions?.routeProvenance),
    /authored reconstruction geometry/,
  );
});

test("Celix 845 renders all authored roads without synthetic-route warnings", () => {
  const result = renderHornSvg(document);
  assert.deepEqual(result.warnings, []);
  assert.equal((result.svg.match(/data-horn-relation=/g) ?? []).length, 9);
  assert.match(result.svg, /data-horn-document="horn:authored:2026:celix-845-specimen-001"/);
  assert.match(result.svg, /data-horn-node="c6-safe-default"/);
});
