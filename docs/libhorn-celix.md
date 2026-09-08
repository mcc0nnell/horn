# libhorn on Apache Celix

Status: analysis reactor landed; Celix is pinned (ADR-0017); native authority still gated by golden equivalence

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

## Why the native ABI is artifact-based first

The semantic-core work is still defining the pre-cartographic argument layer. Freezing C++ `Claim`, `Evidence`, `Issue`, or `Relation` structs now would create a second ontology and force the TypeScript and native implementations to evolve in lockstep.

For the first native contract, Celix services therefore consume and emit serialized contract artifacts. This keeps service discovery and lifecycle native while leaving the schema as the compatibility boundary.

When the semantic core stabilizes, native domain types may be added behind an explicit versioned ABI. They must not silently replace the serialized compatibility surface.

## Celix services

### `horn::IRuntimeDescriptor`

Advertises:

- runtime API: `horn-runtime/0.1`;
- document contract: `horn-document/0.1`;
- projection contract: `horn-projection/0.1`;
- projection views: `argument`, `timeline`, `evidence`, `frontier`.

### `horn::IValidationService`

Returns normalized `horn-validation-report/0.1` JSON from canonical document JSON.

### `horn::IProjectionService`

Returns a renderer-neutral `horn-projection/0.1` artifact. Analytical facts that are not Horn identities live under `extensions["x-analysis"]`. ECharts option objects are forbidden.

### `horn::IQueryService`

Serialized JSON request (`horn-query/0.1`) to serialized JSON result (`horn-query-result/0.1`). Counterfactual analysis is a query operation and never mutates the source artifact.

### `horn::IExplanationService`

Structured explanation of one identity. Optional supporting artifacts may be supplied as a JSON object. The kernel does not generate narrative.

### `horn::IImpactService`

Evidence snapshot + bindings + current document → `horn-impact-report/0.1`. The report describes consequences only.

### `horn::IDiffService`

Before/after Horn artifacts → `horn-diff/0.1`, with authored geometry separated from derived projection consequences.

`horn_inspect` composes these services. It is not itself a semantic authority.

Apache Celix is pinned at an exact commit in `native/celix-pin.json`. CMake
fetches that commit into the build prefix when `HORN_WITH_CELIX=ON`. A host
Celix install is not used. See ADR-0017.

`horn_celix` starts a framework, installs `HornContractBundle`, and invokes the
six analysis services plus `IRuntimeDescriptor` through discovery. `golden:celix`
compares TypeScript, standalone native CLIs, and native-under-Celix.

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

Landed. Proves Apache Celix packaging, container startup, service publication, and the versioned service boundary. Celix itself is now a pinned fetch (ADR-0017), not a host-provided accident.

### Phase 1 — golden validation

Landed. Use `validate:report` and `golden:validation`; see ADR-0015.

### Phase 2 — golden analytical projections

Landed as renderer-neutral projection artifacts. See ADR-0016 and `golden:projection`.

### Phase 3 — query and provenance services

Landed as artifact-based query, explanation, impact, diff, and inspect composition. Equivalence is proven by `golden:reactor` and `golden:torture`.

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
