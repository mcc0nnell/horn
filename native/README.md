# libhorn native runtime

`native/` is Horn's Apache Celix surface. TypeScript remains the reference while native behavior advances through explicit golden equivalence.

The native runtime is deliberately artifact-first. Celix owns lifecycle, service discovery, and composition; it does not own Horn semantics or authored geometry.

## Current services

- `IRuntimeDescriptor` — native contract metadata.
- `IValidationService` — Phase 1 document validation, proven by golden equivalence.
- `IProjectionService` — reserved analytical projection seam.
- `IQueryService` — deterministic structural query seam from ADR-0017.
- `IProofService` — replayable query-proof seam from ADR-0018; native candidate present, normal Celix registration still gated.

## Native query candidate

`horn_query` implements `horn-query-request/0.1` -> `horn-query-result/0.1` in C++ with no Celix dependency.

Supported operations:

- `graph`
- `counterfactual`
- `dominators`
- `min-cut`

The implementation preserves Horn's reader-direction rule: persisted relations remain semantic `response -> earlier claim`, while derived dialogue traversal reads `earlier claim -> response`.

`QueryBundleActivator.cc` is the prepared Celix adapter, but ADR-0017 requires equivalence before normal provider registration. CMake therefore keeps `HornQueryBundle` disabled by default behind `HORN_ENABLE_UNPROVEN_QUERY_PROVIDER=OFF`.

## Native proof candidate

`horn_proof` composes the native query kernel and ports the ADR-0018 proof contract:

- canonical SHA-256 of the full Horn document;
- versioned structural dependency witness;
- deterministic query result;
- content-addressed `horn-proof:<sha256>` identity;
- replay verification with the same issue codes as the TypeScript reference.

The proof kernel is also framework-free. `ProofBundleActivator.cc` is present only for controlled lab composition. Normal proof registration remains disabled behind `HORN_ENABLE_UNPROVEN_PROOF_PROVIDER=OFF` until proof goldens are green.

The proof provider requires the query provider in lab mode. CMake rejects attempts to enable the proof bundle without the query bundle so the dependency order cannot be bypassed accidentally.

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

Create and verify a native proof:

```sh
./build/native/horn_proof create map.horn.json request.json
./build/native/horn_proof verify map.horn.json proof.json
```

## Golden query equivalence

Install the JS dependencies, build `horn_query`, then run:

```sh
node golden/query/compare.mjs
```

Override the binary with `HORN_QUERY=/path/to/horn_query`.

The harness runs the same checked-in query cases through the TypeScript reference and native implementation, canonicalizes parsed JSON, and requires both to match the checked-in expected result.

## Golden proof equivalence

Build `horn_proof`, then run:

```sh
node golden/proof/compare.mjs
```

Override the binary with `HORN_PROOF=/path/to/horn_proof`.

The proof harness compares TypeScript and native proof creation against checked-in content-addressed proofs, then replays those exact proofs through both verifiers and requires the same verification report.

No GitHub Actions are required for either conformance path. Run them locally or through the external CI plane.

## Promotion order

The authority gates remain explicit:

1. establish native query equivalence;
2. deliberately promote the query provider;
3. establish native proof equivalence;
4. deliberately promote the proof provider;
5. add receipt-bearing traversal around canonical claim identities;
6. make Vivisection, Zeppelin, ECharts, SVG, and immersive views consumers of the proven substrate.

See ADR-0019 and ADR-0020.
