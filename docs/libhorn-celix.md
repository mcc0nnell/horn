# libhorn on Apache Celix

Status: initial landed architecture

## Purpose

Horn is growing two execution surfaces at once:

1. a fast TypeScript/Zeppelin/ECharts environment for discovering interaction and projection semantics;
2. a durable native runtime for validation, query, provenance, diff, and projection services.

`libhorn` is the second surface. It lives in this repository under `native/` until it has an independent release and ABI lifecycle.

## Authority boundary

The native runtime does not replace Horn's existing authority rules.

```text
canonical Horn artifacts
        |
        v
+-----------------------+
|       libhorn         |
|     C++ / Celix       |
|                       |
| validation   query    |
| provenance   diff     |
| projection services   |
+-----------+-----------+
            |
      projection artifact
        +---+---+
        |       |
        v       v
   Zeppelin   ECharts
   workbench  analytical UI
```

The canonical `.horn.json` document remains the serialization authority for the authored mural. Analytical projections are derived views. They must never become a round-trip source for historical or authored geometry.

## Historical calibration corpus

The complete seven-map 1998 *Mapping Great Debates: Can Computers Think?* source set is registered in `corpus/cct-1998-series.sources.json`. The registry points at the original copies under `mcc0nnell/web/docs/`, by exact repository path and Git blob identity. See ADR-0016.

Those posters are a calibration and counterexample corpus, not a native runtime dependency. Their purpose is to expose assumptions that only hold on one map before those assumptions become C++ authority.

Source evidence follows an explicit boundary:

```text
historical source -> measured observation -> extraction decision
                  -> semantic Horn artifact -> cartography/projection
```

A libhorn invariant should survive the complete series or be explicitly classified as map-specific, source-observed, derived, or unknown. Unknown behavior is not promoted into native semantics.

## Why the native ABI is artifact-based first

The semantic-core work is still defining the pre-cartographic argument layer. Freezing C++ `Claim`, `Evidence`, `Issue`, or `Relation` structs now would create a second ontology and force the TypeScript and native implementations to evolve in lockstep.

For the first native contract, Celix services therefore consume and emit serialized contract artifacts. This keeps service discovery and lifecycle native while leaving the schema as the compatibility boundary.

When the semantic core stabilizes, native domain types may be added behind an explicit versioned ABI. They must not silently replace the serialized compatibility surface.

## Initial Celix services

### `horn::IRuntimeDescriptor`

Available now. It advertises:

- runtime API: `horn-runtime/0.1`;
- document contract: `horn-document/0.1`;
- projection contract: `horn-projection/0.1`;
- projection views: `argument`, `timeline`, `evidence`, `frontier`.

### `horn::IValidationService`

Phase1 provider returns normalized report JSON from canonical document JSON. Equivalence with validate.ts is proven by golden:validation.

### `horn::IProjectionService`

Reserved seam for analytical projection generation. A provider is intentionally not landed until its normalized output can be compared against the TypeScript ECharts projection reference.

The projection service returns a Horn projection artifact, not an ECharts option. Rendering libraries remain clients of the runtime.

## Projection rule

Horn has two different visual obligations:

- the authored mural preserves geometry and route authorship;
- analytical projections may abstract that geometry to answer a question.

The runtime must keep those obligations distinct. A timeline, evidence network, frontier view, or argument topology may be generated from a Horn document, but none is allowed to rewrite the document it came from.

## Zeppelin rule

Zeppelin is a runtime envelope and workbench, not a Horn authority.

A future `%horn` interpreter should discover libhorn services and call them through a thin adapter. Notebook state may select a document, query, or projection, but a notebook export must not silently mutate the canonical Horn artifact.

## Migration sequence

### Phase 0 — contract bundle

Landed here. Proves Apache Celix packaging, container startup, service publication, and the versioned service boundary.

### Phase 1 — golden validation

Phase 1 is landed. Use validate:report and golden:validation; see ADR-0015.

Acceptance rule: no native-specific interpretation of Horn semantics.

### Phase 1.5 — complete-series calibration

Use the registered seven-map CCT source set to challenge Map 1 assumptions before they become native authority. Preserve source identity, semantic correspondence, and cartographic realization as separate concepts.

Acceptance rule: a behavior that has not been justified across the relevant source evidence remains map-specific or unknown; it does not become a general libhorn rule by convenience.

### Phase 2 — golden analytical projections

Define a renderer-neutral projection artifact and compare TypeScript and native projection output for the four initial views.

Acceptance rule: ECharts receives data from the projection contract; ECharts-specific options remain outside libhorn.

### Phase 3 — query and provenance services

Move deterministic graph queries, provenance traversal, and semantic diff into native services once their contracts are stable.

### Phase 4 — native authority

Only after equivalence is established should libhorn become the preferred headless runtime. TypeScript remains a web adapter and reference client rather than a competing semantic implementation.

## Repository rule

Keep libhorn in `mcc0nnell/horn` while the contracts are co-evolving. Split it into a separate repository only when one or more of these become true:

- independent release cadence;
- external native consumers;
- stable public ABI requirements;
- packaging/distribution concerns materially diverge from the Horn language repository.

Until then, one repository makes conformance fixtures and cross-runtime review substantially safer.

## CI rule

This architecture does not require GitHub Actions. Native conformance can be executed locally or by an external CI plane. CI transport is deliberately outside the Horn runtime contract.
