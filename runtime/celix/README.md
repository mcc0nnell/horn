# Horn Celix handbook rules runtime

This directory is the analysis-only Apache Celix runtime described by ADR-0007.

## Boundary

`.horn.json` remains canonical. This runtime discovers methodology-rule services, evaluates them against a read-only projection of a Horn document, and emits deterministic diagnostics. It does not mutate Horn documents, synthesize mural geometry, replace the TypeScript validator, or duplicate the SVG, ECharts, or Zeppelin layers.

## Profiles

Rules are namespaced by methodological source context:

- `horn.rules.1998.*` — cartographic / *Can Computers Think?* conventions.
- `horn.rules.2003.*` — authoring / *Introduction to Argumentation Mapping* conventions.

The initial slice keeps profile selection explicit at the CLI boundary so a 1998 cartographic convention is not silently treated as a universal Horn rule.

## Planned CLI

```sh
horn-celix analyze ../../maps/chinese-room-slice.horn.json --profile horn-1998
horn-celix analyze ../../maps/chinese-room-slice.horn.json --profile horn-2003 --format json
```

## First rule set

The first implementation targets a small set of deterministic, source-grounded rules:

- `horn.rules.1998.focus-box`
- `horn.rules.1998.argument-reading-direction`
- `horn.rules.2003.claim-atomicity`
- `horn.rules.2003.focus-claim-formulation`

Rules report diagnostics and optional suggestions only.

## Source handling

Horn's books and original map sheets remain external source material. The public repository should contain distilled rule behavior, provenance references, and public-safe fixtures — not reproduced handbook pages or original map text/images.

## Build shape

The runtime is intentionally isolated under `runtime/celix/` and is expected to use Apache Celix C++ services and CMake. The service API is kept small so rules can be loaded, compared, and replaced independently of the Horn document kernel.
