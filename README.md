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

## Chinese Room slice

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

RUSTBELT is a closed Java 21 kernel. Horn does not live there. The two may later share low-level libraries; neither conceptually depends on the other. The world-graph formerly nicknamed “Horn Fabric” stays in RUSTBELT under another name.

See [`docs/adr/0001-horn-is-not-rustbelt.md`](docs/adr/0001-horn-is-not-rustbelt.md).

## Layout

```
maps/          canonical documents (.horn.json)
schema/        horn-document/0.1
src/           TypeScript types + validator
docs/adr/      architectural decisions
```

Code: Apache-2.0. Horn’s original posters remain his / MacroVU’s. This repo does not republish them.
