# Horn

Horn is an executable visual language for mapped argument. You do not look at a poster. You enter one.

This repository is the **document kernel**: a portable `.horn.json` format, a validator, and the first slice — twelve claims from the Chinese Room cluster, authored in Horn’s language. It is not a game engine, not a graph viewer, and not RUSTBELT.

## Product

A Horn document is a mural. Claims have authored geometry. Relations have kinds (`supports`, `disputes`, `warrants`, `addresses`, `interprets-as`) and may carry authored vector routes. Spatial arrangement is the argument’s grammar — not a layout of a graph.

A historical renderer must never replace Horn’s roads with endpoint-to-endpoint graph edges. Historical relations require preserved route geometry; authored documents may remain temporarily unrouted while being constructed, but finished routes are persisted as document data.

See [`docs/adr/0003-relation-geometry-is-authored.md`](docs/adr/0003-relation-geometry-is-authored.md).

Horn keeps two provenance layers distinct:

- **Layer A · Mapped** — the printed debate. Every debate node cites the work it maps (for example Turing 1950 or Searle 1980).
- **Layer B · Cartographic** — how the document was drawn. This is document-level provenance and is inherited by the mural; a node cites Layer B directly only when a cartographic note applies specifically to that node.

Historical maps freeze geometry. Authored maps are marked *after Horn* and must never be silently mixed into a historical document. A historical document contains no authored nodes and no `after` metadata. An authored document must declare `after` and contain at least one explicitly authored node.

`horn-document/0.1` has a small core vocabulary plus an explicit `x-*` extension namespace. New relation or node kinds never arrive by accident: source-faithful additions join the core deliberately; experimental additions stay namespaced until promoted.

## Renderer

`src/render/svg.ts` is the first pure mural renderer. It takes a valid `HornDocument` and returns SVG plus explicit warnings. It paints authored canvas coordinates directly; it does not contain a layout engine.

```ts
import { renderHornSvg } from "./src/render";

const { svg, warnings } = renderHornSvg(document);
```

If an authored relation has no route yet, the renderer omits it and emits an `unrouted-authored-relation` warning. It never invents a line. Historical missing-route cases are rejected by validation before rendering.

`src/render/horn.css` is intentionally neutral. It is a working presentation shell, not a reconstruction of Horn / MacroVU typography, palette, icons, or arrow styling.

See [`docs/adr/0004-renderer-is-pure.md`](docs/adr/0004-renderer-is-pure.md).

Render any Horn document from the command line:

```sh
npm run render -- maps/chinese-room-slice.horn.json > mural.svg
```

For Specimen 001:

```sh
npm run render:celix > celix-845-specimen-001.svg
```

## Camera

`src/view/` turns the rendered mural into a place you can enter without touching document geometry. The camera changes only the SVG `viewBox`.

```ts
import { attachHornCamera } from "./src/view";

const controller = attachHornCamera(svg, document);
controller.focusNode("c5-chinese-room");
```

Interaction is intentionally conventional: pointer drag pans, wheel/trackpad zooms around the cursor, double-click focuses a node, arrow keys pan, `+` / `-` zoom, and `0` / `Home` resets to the full mural.

See [`docs/adr/0005-camera-moves-the-window.md`](docs/adr/0005-camera-moves-the-window.md).

Run the local contract checks with:

```sh
npm install
npm run check
```

## Chinese Room slice

[`maps/chinese-room-slice.horn.json`](maps/chinese-room-slice.horn.json) — twelve nodes on a 2600×1960 poster. Turing supports from the left; Searle disputes from the right; the systems reply sits under the focus claim. Node 12 is an authored gloss, visually distinct.

This is an authored reconstruction in Horn’s visual language, **not a facsimile** of a MacroVU sheet, and not a substitute for the original posters.

## Specimen 001 · Apache Celix PR #845

[`maps/celix-845-specimen-001.horn.json`](maps/celix-845-specimen-001.horn.json) reconstructs a naturally occurring software-engineering argument rather than an argument authored for Horn. The specimen follows the discussion from an initial CycloneDX-in-CI proposal through the artifact-boundary dispute and into the emerging lockfile + SBOM safe-default reference state.

The experiment deliberately keeps the argument graph separate from the physical software graph. [`experiments/celix-845/evidence/sbom-physical-evidence.json`](experiments/celix-845/evidence/sbom-physical-evidence.json) records the actual CycloneDX dependency facts from the PR's workflow artifact; `depends_on` observations do not become Horn argument relations.

All nine argument relations now carry persisted authored roads. Their route provenance is explicit: the geometry belongs to the 2026 reconstruction, not Apache Celix and not an original Robert E. Horn map.

See [`experiments/celix-845/README.md`](experiments/celix-845/README.md).

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

RUSTBELT is a closed Java 21 kernel. Horn does not live there. The two may later share low-level libraries; neither conceptually depends on the other. The world-graph formerly nicknamed “Horn Fabric” stays in RUSTBELT under another name.

See [`docs/adr/0001-horn-is-not-rustbelt.md`](docs/adr/0001-horn-is-not-rustbelt.md).

## Layout

```
maps/          canonical documents (.horn.json)
schema/        horn-document/0.1
src/           TypeScript types + validator
src/render/    pure SVG renderer + neutral CSS shell
src/view/      immutable mural camera + browser controller
experiments/   source-grounded reconstruction specimens
docs/adr/      architectural decisions
```

Code: Apache-2.0. Horn’s original posters remain his / MacroVU’s. This repo does not republish them.
