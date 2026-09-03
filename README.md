# Horn

Horn is an executable visual language for mapped argument. You do not look at a poster. You enter one.

This repository is the **document kernel**: a portable `.horn.json` format, a validator, and the first slice — twelve claims from the Chinese Room cluster, authored in Horn’s language. It is not a game engine, not a graph viewer, and not RUSTBELT.

## Product

A Horn document is a mural. Claims have authored geometry. Relations have kinds (`supports`, `disputes`, `warrants`). Spatial arrangement is the argument’s grammar — not a layout of a graph. Every debate claim carries two citation layers:

- **Layer A · Mapped** — the printed debate (Turing 1950, Searle 1980)
- **Layer B · Cartographic** — how this sheet was drawn, after Horn

Historical maps freeze geometry. Authored maps are marked *after Horn* and must never be silently mixed into a historical document.

## Chinese Room slice

[`maps/chinese-room-slice.horn.json`](maps/chinese-room-slice.horn.json) — twelve nodes on a 2600×1960 poster. Turing supports from the left; Searle disputes from the right; the systems reply sits under the focus claim. Node 12 is an authored gloss, visually distinct.

This is an authored reconstruction in Horn’s visual language, **not a facsimile** of a MacroVU sheet, and not a substitute for the original posters.

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
