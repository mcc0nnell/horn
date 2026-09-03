# Horn

Horn is an executable visual language for mapped argument. You do not look at a poster. You enter one.

This repository is the **document kernel**: a portable `.horn.json` format, a validator, source-calibrated historical reconstruction work, and authored experiments in Horn’s language. It is not a game engine, not a generic graph viewer, and not RUSTBELT.

## Product

A Horn document is a mural. Claims have authored geometry. Relations have kinds (`supports`, `disputes`, `warrants`, `addresses`, `interprets-as`) and may carry authored vector routes. Spatial arrangement is the argument’s grammar — not a layout of a graph.

A historical renderer must never replace Horn’s roads with endpoint-to-endpoint graph edges. Historical relations require preserved route geometry; authored documents may remain temporarily unrouted while being constructed, but finished routes are persisted as document data.

See [`docs/adr/0003-relation-geometry-is-authored.md`](docs/adr/0003-relation-geometry-is-authored.md).

Horn keeps two provenance layers distinct:

- **Layer A · Mapped** — the printed debate. Every debate node cites the work it maps (for example Turing 1950 or Searle 1980).
- **Layer B · Cartographic** — how the document was drawn. This is document-level provenance and is inherited by the mural; a node cites Layer B directly only when a cartographic note applies specifically to that node.

Historical maps freeze geometry. Authored maps are marked *after Horn* and must never be silently mixed into a historical document. A historical document contains no authored nodes and no `after` metadata. An authored document must declare `after` and contain at least one explicitly authored node.

`horn-document/0.1` has a small core vocabulary plus an explicit `x-*` extension namespace. New relation or node kinds never arrive by accident: source-faithful additions join the core deliberately; experimental additions stay namespaced until promoted.

## Projections

Horn is the authored truth. Other systems consume it through derived projection manifests rather than by rewriting Horn documents.

`horn-projection/0.1` names one source Horn document, one target, and the source node/relation identities selected for that target. `src/projection.ts` resolves those identities and rejects stale document references, unknown identities, and relations whose endpoints fall outside the selected node set.

```ts
import { resolveHornProjection } from "./src/projection";

const projection = resolveHornProjection(document, {
  id: "chinese-room-rustbelt",
  version: "horn-projection/0.1",
  source: {
    documentId: document.id,
    documentVersion: "horn-document/0.1",
  },
  target: "rustbelt",
  nodes: ["c5-chinese-room"],
  relations: [],
});
```

A projection does not define target semantics. RUSTBELT decides how a selected Horn identity becomes executable state or operations; an analysis tool decides how it becomes analysis input; a renderer decides how it becomes presentation. None of those outputs become Horn authority merely because they were derived from Horn.

See [`docs/adr/0006-horn-is-authored-truth-projections-are-derived.md`](docs/adr/0006-horn-is-authored-truth-projections-are-derived.md).

## Renderer

`src/render/svg.ts` is the first pure mural renderer. It takes a valid `HornDocument` and returns SVG plus explicit warnings. It paints authored canvas coordinates directly; it does not contain a layout engine.

```ts
import { renderHornSvg } from "./src/render";

const { svg, warnings } = renderHornSvg(document);
```

If an authored relation has no route yet, the renderer omits it and emits an `unrouted-authored-relation` warning. It never invents a line. Historical missing-route cases are rejected by validation before rendering.

`src/render/horn.css` is intentionally neutral. It is a working presentation shell, not a reconstruction of Horn / MacroVU typography, palette, icons, or arrow styling.

See [`docs/adr/0004-renderer-is-pure.md`](docs/adr/0004-renderer-is-pure.md).

## Camera

`src/view/` turns the rendered mural into a place you can enter without touching document geometry. The camera changes only the SVG `viewBox`.

```ts
import { attachHornCamera } from "./src/view";

const controller = attachHornCamera(svg, document);
controller.focusNode("c5-chinese-room");
```

Interaction is intentionally conventional: pointer drag pans, wheel/trackpad zooms around the cursor, double-click focuses a node, arrow keys pan, `+` / `-` zoom, and `0` / `Home` resets to the full mural.

See [`docs/adr/0005-camera-moves-the-window.md`](docs/adr/0005-camera-moves-the-window.md).

## ECharts analytical projections

`src/echarts/` derives disposable Apache ECharts views from the same canonical `HornDocument`. ECharts does **not** replace the mural renderer and does not own or rewrite Horn geometry.

The current vertical slice exposes four projections:

- **Argument** — semantic support/dispute topology. Relation routes are intentionally abstracted.
- **Timeline** — dated claims laid out chronologically.
- **Evidence** — mapped and cartographic sources connected to the claims that cite them.
- **Frontier** — reader-facing dialogue threads derived from focus boxes out to their current terminal arguments.

The Argument and Frontier views deliberately use opposite directions for the same dialectical relation. `HornRelation.from -> HornRelation.to` is semantic response direction; Horn’s historical arrows guide the reader from the earlier claim toward the later response. `src/structure.ts` derives that reader-facing thread without changing the canonical relation or its route geometry.

```ts
import {
  mountHornECharts,
  mountHornEChartsTriptych,
  projectHornDocument,
} from "./src/echarts";

const projections = projectHornDocument(document);

const controller = mountHornECharts(element, document, "argument");
controller.setView("frontier");

const triptych = mountHornEChartsTriptych(
  { argument: argumentEl, timeline: timelineEl, evidence: evidenceEl },
  document,
);
```

The projection boundary is deliberate: ECharts options are derived state and are never serialized back into `.horn.json`. The canonical SVG mural remains the reference for Horn’s authored spatial grammar.

See [`docs/adr/0006-echarts-is-an-analytical-projection.md`](docs/adr/0006-echarts-is-an-analytical-projection.md) and [`docs/adr/0007-semantic-and-reading-direction-are-distinct.md`](docs/adr/0007-semantic-and-reading-direction-are-distinct.md).

Run the local contract checks with:

```sh
npm install
npm run check
```

## Source corpus and calibration

`corpus/` contains compact source-backed reconstruction evidence. Source measurements remain distinct from adopted historical Horn geometry.

- [`corpus/cct-1998-map1-index.json`](corpus/cct-1998-map1-index.json) records the eleven Map 1 issue areas and focus-box numbers.
- [`corpus/cct-1998-map1-geometry.json`](corpus/cct-1998-map1-geometry.json) records measured issue-area raster extents.
- [`corpus/cct-1998-map1-calibration-slice.json`](corpus/cct-1998-map1-calibration-slice.json) calibrates seven boxes and four local roads across the small 59–65 regions.
- [`corpus/cct-1998-worldviews-index.json`](corpus/cct-1998-worldviews-index.json) indexes the handbook’s named postulate/worldview sets without reproducing their text.

`src/source/` validates pixel-to-normalized geometry and source-calibration invariants. See ADR 0008 and ADR 0009.

## Historical CCT slice

[`maps/cct-map1-small-regions.horn.json`](maps/cct-map1-small-regions.horn.json) is the first source-calibrated historical `HornDocument` from the 1998 *Can Computers Think?* map set.

It reconstructs boxes 59–65 across three issue areas:

- heads-in-the-sand: 59 -> 60 in reading order;
- theology: 61 -> 62;
- arithmetic: 63 -> 64 and 63 -> 65.

The document adopts the calibrated 8259 × 5191 source-raster coordinate system as its Horn canvas. Box rectangles are high-confidence source measurements. Relation routes are explicitly marked medium-confidence **centerline approximations**; full arrow polygons, starburst relation labels, and historical arrowheads are not claimed as reconstructed.

The claim texts in the file are paraphrases. Layer A citations point to the published works Horn maps; Layer B identifies Horn’s 1998 cartography.

## Chinese Room authored slice

[`maps/chinese-room-slice.horn.json`](maps/chinese-room-slice.horn.json) — twelve nodes on a 2600×1960 poster. Turing supports from the left; Searle disputes from the right; the systems reply sits under the focus claim. Node 12 is an authored gloss, visually distinct.

This is an authored reconstruction in Horn’s visual language, **not a facsimile** of a MacroVU sheet, and not a substitute for the original posters.

## Document invariants

The runtime validator checks what JSON Schema alone cannot express cleanly:

- unique node, relation, region, citation, and claim-number identities
- positive finite canvas and geometry
- node/region geometry contained by the authored canvas
- valid relation endpoints and no self-relations
- valid, nonrepeating reading paths
- Layer A citation on every debate node
- Layer B provenance on every document
- cartographic provenance on authored nodes
- historical/authored authority separation
- authored relation routes for historical documents

See [`docs/adr/0002-horn-document-invariants.md`](docs/adr/0002-horn-document-invariants.md).

## Not RUSTBELT

RUSTBELT is a closed Java 21 kernel. Horn does not live there and RUSTBELT does not become Horn. Their explicit seam is a derived projection: Horn describes the authored graph; a projection selects source identities; RUSTBELT may interpret that selection into its own typed IR and deterministic kernel.

See [`docs/adr/0001-horn-is-not-rustbelt.md`](docs/adr/0001-horn-is-not-rustbelt.md) and [`docs/adr/0006-horn-is-authored-truth-projections-are-derived.md`](docs/adr/0006-horn-is-authored-truth-projections-are-derived.md).

## Layout

```
corpus/        source indexes, source geometry, calibration evidence
maps/          canonical documents (.horn.json)
schema/        horn-document/0.1 + horn-projection/0.1 (+ extraction/argument as landed)
src/           TypeScript types + validators + projection + derived thread structure
src/source/    source geometry + calibration validation
src/render/    pure SVG renderer + neutral CSS shell
src/view/      immutable mural camera + browser controller
src/echarts/   derived Argument / Timeline / Evidence / Frontier projections
docs/adr/      architectural decisions
docs/sources/  source-derived reconstruction constraints and measurement notes
```

Code: Apache-2.0. Horn’s original posters remain his / MacroVU’s. This repo does not republish them.
