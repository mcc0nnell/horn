# ADR-0016: Complete CCT series as a calibration corpus

Status: Proposed

## Context

The initial Horn corpus and native conformance work have been driven mostly by Map 1 and a small number of derived fixtures. That is enough to prove implementation mechanics, but not enough to distinguish true Horn invariants from properties that happen to hold on one poster.

The complete 1998 seven-map *Mapping Great Debates: Can Computers Think?* set is available in `mcc0nnell/web` under `docs/`, together with the series handbook and a vector authoring source for the Chinese Room map.

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

The source registry records repository path, Git blob identity, and byte length for each map. These fields identify the exact source bytes used for calibration without copying the posters into the Horn repository.

For Map 4, the registry also records the available Illustrator source as a related authoring artifact. It may be used to compare rendered PDF structure against vector authoring structure, but it is not automatically more semantically authoritative than Horn's published map.

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
- Native authority continues to advance only through explicit contracts and golden equivalence.
