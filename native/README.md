# libhorn native runtime

`native/` is the Apache Celix surface and headless analysis reactor for Horn.

Contract-first. TypeScript remains the reference until a behavior has golden
equivalence. Canonical Horn artifacts stay authoritative; analyses are derived
and disposable.

## What is here

- `IRuntimeDescriptor`
- `IValidationService` (Phase 1)
- `IProjectionService` (renderer-neutral analytical views)
- `IQueryService` (including counterfactual analysis)
- `IExplanationService`
- `IImpactService`
- `IDiffService`
- CLIs: `horn_validate`, `horn_project`, `horn_query`, `horn_explain`,
  `horn_impact`, `horn_diff`, `horn_inspect`
- `HornContractBundle` + `HornContractRuntime` when Celix is available

Service I/O remains serialized JSON artifacts. There are no ECharts option
objects in libhorn.

## Build

Celix is not required for the analysis CLIs:

    cmake -S native -B build/native
    cmake --build build/native
    ./build/native/horn_validate maps/chinese-room-slice.horn.json
    ./build/native/horn_project maps/chinese-room-slice.horn.json argument
    ./build/native/horn_inspect maps/chinese-room-slice.horn.json --projection frontier

If Celix is missing, only the libraries and CLIs are built.

When Celix is present, `HornContractBundle` registers the providers with
explicit contract version properties. `horn_inspect` composes the same
algorithms without introducing network transport or application policy.

## Golden analysis

Install deps, then:

    npm test
    npm run golden:validation
    npm run golden:projection
    npm run golden:reactor
    npm run golden:torture

Override native binaries with `HORN_VALIDATE`, `HORN_PROJECT`, or
`HORN_NATIVE_BIN`. Regenerate expected artifacts with `--generate-expected`.

See `docs/adr/0016-libhorn-deterministic-analysis-reactor.md`.
