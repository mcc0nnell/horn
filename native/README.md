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
- `HornContractBundle` + `HornContractRuntime` against the pinned Celix
- `horn_celix` — in-framework driver that looks up the six analysis services

Service I/O remains serialized JSON artifacts. There are no ECharts option
objects in libhorn.

Apache Celix is pinned at `native/celix-pin.json` (exact commit, not latest).
The default CMake build fetches that pin into `build/native/celix-root`. A
host-installed Celix is not used. This pin is a documented safe-default for
HornContractBundle; it is not a claim about every Celix configuration.

Requires CMake 3.19 or newer (`string(JSON)` reads the pin file).

## Build

Analysis CLIs still build without Celix:

    cmake -S native -B build/native -DHORN_WITH_CELIX=OFF
    cmake --build build/native

Pinned Celix (default):

    cmake -S native -B build/native -DHORN_WITH_CELIX=ON
    cmake --build build/native
    ./build/native/horn_celix probe
    ./build/native/horn_celix project maps/chinese-room-slice.horn.json argument

A clean container build, from the repository root:

    docker build -f native/Dockerfile .

`HornContractBundle` registers the providers with explicit contract version
properties. `horn_celix` discovers those services inside a real framework.
`horn_inspect` composes the same algorithms without Celix.

## Golden analysis

Install deps, then:

    npm test
    npm run golden:validation
    npm run golden:projection
    npm run golden:reactor
    npm run golden:torture
    npm run golden:celix

Override native binaries with `HORN_VALIDATE`, `HORN_PROJECT`, `HORN_NATIVE_BIN`,
or `HORN_CELIX`. Regenerate expected artifacts with `--generate-expected`.

See `docs/adr/0016-libhorn-deterministic-analysis-reactor.md` and
`docs/adr/0017-libhorn-pins-celix.md`.
