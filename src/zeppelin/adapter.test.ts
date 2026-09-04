import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderHornSvg } from "../render";
import type { HornDocument } from "../types";
import {
  HornZeppelinValidationError,
  inspectHornSource,
  muralToZeppelinHtml,
  prepareHornDocument,
  projectAudit,
  projectManifest,
  projectMural,
  projectNetwork,
} from "./adapter";

const source = readFileSync(
  new URL("../../maps/chinese-room-slice.horn.json", import.meta.url),
  "utf8",
);

test("manifest binds projections to exact document bytes", () => {
  const first = prepareHornDocument(source);
  const second = prepareHornDocument(source);
  const changedBytes = prepareHornDocument(`${source}\n`);

  assert.equal(first.sha256, second.sha256);
  assert.notEqual(first.sha256, changedBytes.sha256);

  const manifest = projectManifest(first);
  assert.equal(manifest.documentId, "horn:authored:2026:chinese-room");
  assert.equal(manifest.hornSchema, "horn-document/0.1");
  assert.equal(manifest.projectionContract, "horn-zeppelin/0.1");
  assert.equal(manifest.renderer, "horn-svg");
});

test("invalid source is inspectable but blocks every downstream projection", () => {
  const inspection = inspectHornSource("{}");
  assert.equal(inspection.valid, false);
  assert.ok(inspection.issues.some((issue) => issue.code === "invalid-structure"));
  assert.throws(
    () => prepareHornDocument("{}"),
    HornZeppelinValidationError,
  );
});

test("mural projection is the existing pure renderer output", () => {
  const prepared = prepareHornDocument(source);
  const mural = projectMural(prepared);
  const canonical = renderHornSvg(prepared.document);

  assert.equal(mural.svg, canonical.svg);
  assert.deepEqual(mural.warnings, canonical.warnings);
  assert.match(mural.svg, /data-horn-node="c1-machines-can-think"/);
  assert.match(mural.svg, /data-horn-relation="r-c2-c1"/);
});

test("Zeppelin HTML keeps hostile document text escaped", () => {
  const hostile = JSON.parse(source) as HornDocument;
  hostile.nodes[0]!.text = '<script>globalThis.pwned = true</script><img src=x onerror="pwned()">';

  const prepared = prepareHornDocument(JSON.stringify(hostile));
  const output = muralToZeppelinHtml(prepared);

  assert.doesNotMatch(output, /<script>/i);
  assert.doesNotMatch(output, /<img src=x/i);
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, new RegExp(prepared.sha256));
});

test("network projection preserves semantic identities and declares loss", () => {
  const prepared = prepareHornDocument(source);
  const network = projectNetwork(prepared);

  assert.equal(network.directed, true);
  assert.equal(network.hornProjection.fidelity, "lossy-semantic-projection");
  assert.equal(network.hornProjection.roundTrip, false);
  assert.equal(network.hornProjection.sourceSha256, prepared.sha256);
  assert.ok(network.hornProjection.omitted.includes("relation.route.commands"));

  assert.deepEqual(
    new Set(network.nodes.map((node) => node.id)),
    new Set(prepared.document.nodes.map((node) => node.id)),
  );
  assert.deepEqual(
    new Set(network.edges.map((edge) => edge.id)),
    new Set(prepared.document.relations.map((relation) => relation.id)),
  );

  for (const edge of network.edges) {
    const relation = prepared.document.relations.find((item) => item.id === edge.id);
    assert.ok(relation);
    assert.equal(edge.source, relation.from);
    assert.equal(edge.target, relation.to);
    assert.equal(edge.label, relation.kind);
  }
});

test("audit keeps mapped and cartographic provenance separate", () => {
  const prepared = prepareHornDocument(source);
  const audit = projectAudit(prepared);

  assert.ok(audit.layerA.length > 0);
  assert.ok(audit.layerB.length > 0);
  assert.ok(audit.layerA.every((citation) => citation.layer === "mapped"));
  assert.ok(audit.layerB.every((citation) => citation.layer === "cartographic"));

  const focus = audit.nodes.find((node) => node.id === "c1-machines-can-think");
  assert.ok(focus);
  assert.ok(focus.mappedCitationIds.includes("turing-1950"));

  const afterHorn = audit.nodes.find((node) => node.id === "a1-stable-argumentation");
  assert.ok(afterHorn);
  assert.equal(afterHorn.origin, "authored");
  assert.ok(afterHorn.directCartographicCitationIds.includes("horn-cct-cartographic"));

  assert.ok(audit.relations.every((relation) => relation.hasPersistedRoute));
  assert.ok(audit.relations.every((relation) => relation.routeCommandCount >= 2));
});
