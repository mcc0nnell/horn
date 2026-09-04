# Horn

Horn is a visual reasoning language and document kernel inspired by Robert E. Horn's visual-language and argument-mapping work.

The repository separates authored argument structure from rendering and navigation. A Horn document owns its geometry, provenance, argument vocabulary, and reading path; the renderer consumes that document without inventing layout or historical reconstruction details.

## Current specimens

### Chinese Room slice

`maps/chinese-room-slice.horn.json` is the first authored after-Horn specimen. It tests the core document invariants against a bounded philosophical argument cluster.

### Specimen 001 — Apache Celix PR #845

`maps/celix-845-specimen-001.horn.json` reconstructs a naturally occurring software-engineering argument around SBOM artifact boundaries, source releases, reproducible dependency state, safe defaults, and vulnerability auditing.

The specimen deliberately keeps two graphs distinct:

- Horn argument relations express what participants claim, support, dispute, or address.
- `experiments/celix-845/evidence/sbom-physical-evidence.json` records the actual CycloneDX dependency facts from the PR's generated workflow artifact.

Every Celix argument relation has persisted authored road geometry. Render it with:

```bash
npm run render:celix > celix-845-specimen-001.svg
```

The renderer will not synthesize missing routes.

## Development

```bash
npm run check
```

Render any Horn document to SVG:

```bash
npm run render -- maps/chinese-room-slice.horn.json > mural.svg
```

## Design constraints

See `docs/adr/` for the current architecture decisions. The important invariants are:

- Horn is not RUSTBELT.
- document geometry is authored data;
- source/mapped provenance and cartographic provenance remain distinguishable;
- rendering is pure;
- camera movement changes only the viewport;
- missing historical geometry is not silently synthesized.

The goal is not to produce decorative mind maps. Horn should preserve the topology of a reasoned structure well enough that a reader can inspect what is claimed, what disputes it, where the evidence came from, and what remains unresolved.
