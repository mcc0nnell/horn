# libhorn native runtime

`native/` is Horn's Apache Celix surface. TypeScript remains the reference while native behavior advances through explicit golden equivalence.

The native runtime is deliberately artifact-first. Celix owns lifecycle, service discovery, and composition; it does not own Horn semantics or authored geometry.

## Current services

- `IRuntimeDescriptor` — native contract metadata.
- `IValidationService` — Phase 1 document validation, proven by golden equivalence.
- `IProjectionService` — reserved analytical projection seam.
- `IQueryService` — deterministic structural query seam from ADR-0017.
- `IProofService` — reserved proof seam from ADR-0018; **no provider is registered yet**.

## Native query candidate

`horn_query` is the first C++ implementation of `horn-query-request/0.1` -> `horn-query-result/0.1`.
It implements the TypeScript reference operations:

- `graph`
- `counterfactual`
- `dominators`
- `min-cut`

The implementation preserves Horn's existing reader-direction rule: persisted relations remain semantic `response -> earlier claim`, while derived dialogue traversal reads `earlier claim -> response`.

The C++ library has no Celix dependency. `QueryBundleActivator.cc` is the prepared Celix adapter, but ADR-0017 requires equivalence before normal provider registration. CMake therefore keeps `HornQueryBundle` disabled by default behind `HORN_ENABLE_UNPROVEN_QUERY_PROVIDER=OFF`.

The opt-in switch exists only for controlled lab work. It must not be interpreted as native Horn authority.

## Build without Celix

```sh
cmake -S native -B build/native
cmake --build build/native
ctest --test-dir build/native --output-on-failure
```

Run a native query:

```sh
./build/native/horn_query map.horn.json request.json
```

## Golden query equivalence

Install the JS dependencies, build `horn_query`, then run:

```sh
node golden/query/compare.mjs
```

Override the binary with `HORN_QUERY=/path/to/horn_query`.

The harness runs the same checked-in query cases through the TypeScript reference and the native implementation, canonicalizes parsed JSON, and requires both to match the checked-in expected result.

Once that conformance evidence is green in the trusted external/local build environment, a later reviewed commit can promote `HornQueryBundle` from opt-in candidate to normal Celix provider. No GitHub Actions are required for this conformance path.

## Proof gate

ADR-0018 is explicit: `IProofService` remains interface-only until native query equivalence exists and proof output gets its own golden coverage. This slice does not jump that gate.

Once query equivalence is established, the next native pass is replayable proof generation/verification, followed by receipt-bearing traversal and Vivisection adapters.
