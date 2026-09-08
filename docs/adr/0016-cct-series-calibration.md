# ADR-0016: Complete CCT series as a calibration corpus

Status: Proposed

## Context

The initial Horn corpus and native conformance work have been driven mostly by Map 1 and a small number of derived fixtures. That is enough to prove implementation mechanics, but not enough to distinguish true Horn invariants from properties that happen to hold on one poster.

The complete 1998 seven-map *Mapping Great Debates: Can Computers Think?* set is available in `mcc0nnell/web`. The repository contains both archived copies under `docs/` and normalized mirrors under `public/horn/`, together with the series handbook and a vector authoring source for the Chinese Room map. The normalized map, handbook, and Map 4 vector copies are byte-identical to their archived counterparts, as shown by their Git blob identities.

`libhorn` must not infer runtime semantics directly from poster pixels. The posters are historical source authority for extraction and reconstruction, not an executable ontology.

## Decision

Register the complete source set in `corpus/cct-1998-series.sources.json` and use it as the primary historical stress corpus for native generalization work.

The calibration pipeline is:

```text
immutable historical source
        |
        v
measured source observations
        |
        v
explicit extraction decisions
        |
        v
semantic Horn artifacts
        |
        v
authored cartography / analytical projections
```

Each boundary remains observable. No stage is allowed to silently collapse into the next.

### Source identity

The source registry records a preferred repository path, Git blob identity, byte length, and optional path aliases for each source artifact.

Git blob identity is the source-byte identity. Repository paths are locators. When an archived `docs/` path and a normalized `public/horn/` path resolve to the same blob identity, they are two names for the same registered source bytes, not two independent sources.

For the seven maps, prefer the normalized `public/horn/maps/` locators while retaining archived `docs/` aliases. The handbook follows the same rule through `public/horn/library/`. Map 4 records the normalized Illustrator source under `public/horn/source/` and its archived alias.

For Map 4, the Illustrator source may be used to compare rendered PDF structure against vector authoring structure, but it is not automatically more semantically authoritative than Horn's published map.

### Generalization rule

Every behavior proposed as a Horn invariant should be classified, with evidence, as one of:

- `series-invariant`
- `map-specific`
- `source-observed`
- `derived`
- `unknown`

`unknown` behavior must not be promoted into native runtime authority.

When another poster falsifies a Map 1 assumption, add the counterexample fixture first, then change the model at the narrowest justified layer.

### Cross-map identity

Source identity, semantic correspondence, and cartographic realization are distinct.

Repeated labels, similar wording, or visual resemblance across posters are not enough to merge identities. A future series index may express explicit or evidence-backed correspondences while preserving each map-local source identity.

### Runtime boundary

`libhorn` may derive deterministic queries, projections, provenance traces, diffs, impact results, and proof artifacts from canonical Horn artifacts.

It must not:

- depend on poster PDFs at runtime;
- treat raster coordinates as authored Horn geometry automatically;
- infer philosophical truth from visual similarity;
- rewrite canonical Horn state from a derived analytical projection;
- turn a counterfactual result into authored state implicitly.

## Consequences

- The seven posters become a regression corpus for finding bad assumptions, not merely visual references.
- Map 1 can no longer define the whole runtime by accident.
- Cross-map work can proceed without collapsing source identities.
- The historical source set stays external to the Horn repository while remaining byte-identifiable.
- Normalized and archived repository paths can move independently without changing source identity when their blob identity remains the same.
- Native authority continues to advance only through explicit contracts and golden equivalence.
