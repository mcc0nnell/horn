# Horn

Horn is an executable visual language for mapped argument. You do not look at a poster. You enter one.

This repository is becoming a portable implementation of Horn's argumentation-mapping method: semantic argument structure, authored cartography, validation, rendering, and derived projections. It is not a game engine, not a generic graph viewer, and not RUSTBELT.

## The language

Horn is not a new programming syntax. Its language is the set of distinctions used to turn discourse into an inspectable argument:

```text
sources
  ↓
identify claims
  ↓
select claims
  ↓
write / normalize claims
  ↓
issue + focus claim
  ↓
positions / grounds / warrants / backing / rebuttals
  ↓
support moves / disputes / backing
  ↓
argument streams + subarguments
  ↓
authored cartography
```

The repository separates the semantic argument from its visual realization.

### `horn-argument/0.1`

`schema/horn-argument-0.1.schema.json` is the geometry-free semantic IR. It records the issue question and issue type, sources, atomic claims, argumentative roles, relations, the focus claim, streams, and subarguments.

The core claim roles follow Horn's argumentation-mapping method:

- `position`
- `grounds`
- `warrant`
- `backing`
- `rebuttal`

A warrant licenses a particular **support move**; it is not merely another edge aimed at a position. A `supports` relation may name `warrantClaimId`. A `backs` relation must run from a backing claim to a warrant claim.

```json
{
  "id": "grounds-support-position",
  "kind": "supports",
  "from": "grounds-smoke",
  "to": "position-fire",
  "warrantClaimId": "warrant-smoke-means-fire"
}
```

`src/argument.ts` provides the corresponding TypeScript model and cross-reference validator.

See [`docs/adr/0007-horn-has-a-semantic-argument-layer.md`](docs/adr/0007-horn-has-a-semantic-argument-layer.md) and [`docs/adr/0008-warrants-license-support-moves.md`](docs/adr/0008-warrants-license-support-moves.md).

### `horn-document/0.1`

A Horn document is authored cartography. Claims have geometry. Relations have kinds (`supports`, `disputes`, `warrants`, `addresses`, `interprets-as`) and may carry authored vector routes. Spatial arrangement is the argument's grammar — not an automatic layout of a graph.

A semantic argument may inform a Horn document, but the transition is an authoring act. Historical geometry remains evidence and must never be replaced with synthetic endpoint-to-endpoint graph edges.

A semantic warrant may therefore appear cartographically as a separate `warrants` road from its warrant box toward the supported position. That road realizes the semantic support's `warrantClaimId`; it does not imply that the semantic IR contains a free-standing warrant edge.

See [`docs/adr/0003-relation-geometry-is-authored.md`](docs/adr/0003-relation-geometry-is-authored.md).

## Chinese Room semantic specimen

[`arguments/chinese-room.horn-argument.json`](arguments/chinese-room.horn-argument.json) is the first semantic specimen. It preserves the identities used by the Chinese Room mural while separating the argument from the authored geometry.

It contains three streams:

- Turing support
- Searle dispute
- systems reply / internalization

`src/correspondence.ts` validates the semantic-to-cartographic seam. Debate claim identities must survive into the mural; semantic support/dispute relations must retain their identities and endpoints; semantic warrants must have corresponding cartographic warrant roads; authored cartographic overlays are allowed without becoming semantic claims.

That gives Horn an explicit invariant: **claim identity survives cartography; geometry remains authored.**

## Provenance

Horn keeps semantic/source provenance and cartographic provenance distinct.

For cartographic documents the existing two layers remain:

- **Layer A · Mapped** — the printed debate. Every debate node cites the work it maps.
- **Layer B · Cartographic** — how the document was drawn. This is document-level provenance and is inherited by the mural; a node cites Layer B directly only when a cartographic note applies specifically to that node.

Historical maps freeze geometry. Authored maps are marked *after Horn* and must never be silently mixed into a historical document.

`horn-document/0.1` has a small core vocabulary plus an explicit `x-*` extension namespace. New relation or node kinds never arrive by accident: source-faithful additions join the core deliberately; experimental additions stay namespaced until promoted.

## Projections

Horn source artifacts remain authoritative. Other systems consume them through derived projections rather than rewriting Horn into target-specific ontologies.

The first projection interchange, `horn-projection/0.1`, currently selects node/relation identities from a `horn-document/0.1` cartographic document. `src/projection.ts` resolves those identities and rejects stale source references, unknown identities, and incomplete relation closures.

A projection does not define target semantics. RUSTBELT decides how selected Horn identities become executable state or operations. Analysis tools and renderers define their own interpretations. None of those outputs acquire Horn authority merely because they were derived from Horn.

A later projection revision may select directly from `horn-argument/0.1`; the semantic layer is being stabilized before that manifest is generalized.

See [`docs/adr/0006-horn-is-authored-truth-projections-are-derived.md`](docs/adr/0006-horn-is-authored-truth-projections-are-derived.md).

## Renderer

`src/render/svg.ts` is the first pure mural renderer. It takes a valid `HornDocument` and returns SVG plus explicit warnings. It paints authored canvas coordinates directly; it does not contain a layout engine.

If an authored relation has no route yet, the renderer omits it and emits an `unrouted-authored-relation` warning. It never invents a line. Historical missing-route cases are rejected by validation before rendering.

`src/render/horn.css` is intentionally neutral. It is a working presentation shell, not a reconstruction of Horn / MacroVU typography, palette, icons, or arrow styling.

See [`docs/adr/0004-renderer-is-pure.md`](docs/adr/0004-renderer-is-pure.md).

## Camera

`src/view/` turns the rendered mural into a place you can enter without touching document geometry. The camera changes only the SVG `viewBox`.

Interaction is intentionally conventional: pointer drag pans, wheel/trackpad zooms around the cursor, double-click focuses a node, arrow keys pan, `+` / `-` zoom, and `0` / `Home` resets to the full mural.

See [`docs/adr/0005-camera-moves-the-window.md`](docs/adr/0005-camera-moves-the-window.md).

Run the local contract checks with:

```sh
npm install
npm run check
```

## Chinese Room mural

[`maps/chinese-room-slice.horn.json`](maps/chinese-room-slice.horn.json) — twelve nodes on a 2600×1960 poster. Turing supports from the left; Searle disputes from the right; the systems reply sits under the focus claim. Node 12 is an authored gloss, visually distinct.

This is an authored reconstruction in Horn's visual language, **not a facsimile** of a MacroVU sheet, and not a substitute for the original posters.

## Document invariants

The cartographic validator checks what JSON Schema alone cannot express cleanly:

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

RUSTBELT is a closed Java 21 kernel. Horn does not live there and RUSTBELT does not become Horn.

Horn owns argument meaning and authored cartography. A projection may select Horn identities. A target adapter may then interpret that selection into RUSTBELT's own typed IR and deterministic kernel.

See [`docs/adr/0001-horn-is-not-rustbelt.md`](docs/adr/0001-horn-is-not-rustbelt.md), [`docs/adr/0006-horn-is-authored-truth-projections-are-derived.md`](docs/adr/0006-horn-is-authored-truth-projections-are-derived.md), and [`docs/adr/0007-horn-has-a-semantic-argument-layer.md`](docs/adr/0007-horn-has-a-semantic-argument-layer.md).

## Layout

```text
arguments/          semantic Horn arguments (.horn-argument.json)
maps/               authored cartographic documents (.horn.json)
schema/             horn-argument/0.1 + horn-document/0.1 + horn-projection/0.1
src/argument*       semantic argument types + validator
src/correspondence* semantic ↔ cartographic contract
src/projection*     derived projection resolver
src/render/         pure SVG renderer + neutral CSS shell
src/view/           immutable mural camera + browser controller
docs/adr/           architectural decisions
```

Code: Apache-2.0. Horn's original posters remain his / MacroVU's. This repo does not republish them.
