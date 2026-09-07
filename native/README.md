# libhorn native runtime

`native/` is the first Apache Celix surface for Horn.

It is intentionally a contract-first slice. The existing Horn document kernel remains authoritative, and the TypeScript/Zeppelin/ECharts work remains the reference implementation while native behavior is brought up behind golden equivalence tests.

## What is here

- `horn::IRuntimeDescriptor` — advertises the runtime, document, and projection contracts.
- `horn::IValidationService` — stable Celix seam for document validation.
- `horn::IProjectionService` — stable Celix seam for analytical projections.
- `HornContractBundle` — a real Celix bundle that registers the runtime descriptor service.
- `HornContractRuntime` — a minimal Celix container for exercising the bundle.

The validation and projection interfaces deliberately exchange serialized contract artifacts instead of exposing native Horn domain structs. This keeps the C++ ABI from freezing a semantic model while `horn-argument` and the analytical projection contracts are still being hardened.

## Invariants

The native runtime must not:

- become a second serialization authority for `.horn.json`;
- rewrite authored Horn geometry;
- invent historical relation routes;
- make ECharts options part of the semantic core;
- make Zeppelin part of the runtime ABI.

ECharts is a client projection. Zeppelin is a workbench. Celix is the native service runtime.

## Build

Apache Celix must be discoverable by CMake.

```sh
cmake -S native -B build/native
cmake --build build/native
./build/native/deploy/HornContractRuntime/HornContractRuntime
```

The current Celix C++ model uses `celix::BundleContext::registerService` for service publication, `add_celix_bundle` for bundle packaging, and `add_celix_container` for a runnable container. This slice follows that model directly.

## Next native milestone

Do not implement native semantic behavior by guessing at the TypeScript implementation.

The next step is a golden corpus that runs the same canonical Horn artifact through both runtimes and compares normalized outputs. Only after that proof should `IValidationService` and `IProjectionService` receive native providers.

Target sequence:

```text
canonical .horn.json
      |--------------------|
      v                    v
TypeScript reference    libhorn/Celix
      |                    |
      v                    v
normalized validation / projection artifact
      |____________________|
               |
          exact compare
```

No GitHub Actions configuration is introduced by this native slice.
