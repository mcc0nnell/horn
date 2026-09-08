# libhorn native runtime

`native/` is the Apache Celix runtime surface for Horn.

Horn remains an executable visual language for mapped argument. The native
runtime does **not** turn Horn into a game engine and it does not make Celix,
SCUMM, RUSTBELT, ECharts, or a renderer authoritative over Horn artifacts.

The design borrows a few useful runtime ideas from SCUMM3 and rewrites them in
Horn terms:

- framework-free deterministic semantics;
- canonical runtime state;
- explicit operations and effects;
- immutable SHA-256 transition receipts;
- presentation and analysis as derived adapters rather than state authority.

There is no SCUMM3 runtime dependency.

## Runtime split

```text
horn-argument/0.1
      |
      v
TraversalRuntime               horn-document/0.1
pure deterministic core              |
      |                               |
      v                               v
horn-runtime-state/0.1          authored cartography
      |                               |
      +---- transition receipts       +---- SVG / ECharts / 3D adapters
      |
      v
Apache Celix ITraversalService
```

The traversal core consumes the geometry-free semantic argument. Authored Horn
cartography stays separate and authoritative for spatial meaning. Claim identity
is the seam between the two.

## Native targets

- `horn_validation` / `horn_validate` — Phase 1 document validation parity.
- `horn_engine` — deterministic semantic traversal core; no Celix dependency.
- `horn_traverse` — init/step CLI for the traversal contracts.
- `HornContractBundle` — validation/runtime descriptor Celix services.
- `HornEngineBundle` — Celix `ITraversalService` provider.
- `HornEngineRuntime` — Celix container with both bundles.

## Runtime contracts

`ITraversalService` uses serialized JSON artifacts while the contracts settle:

- `horn-runtime-state/0.1`
- `horn-runtime-operation/0.1`
- `horn-transition-receipt/0.1`
- `horn-runtime-transition/0.1`

Supported operations in the first slice:

- `enter-claim`
- `follow-relation`
- `enter-stream`
- `leave-stream`
- `focus-issue`

`follow-relation` records whether the move followed the semantic relation
forward or reverse; traversal never rewrites the authored relation.

If an active stream is selected, traversal cannot silently jump to a claim
outside that stream. Every successful step increments the runtime step,
normalizes visited claim identities, hashes source and target state, and emits a
receipt. A supplied previous receipt must verify and terminate at the supplied
source state.

## Build without Celix

```sh
cmake -S native -B build/native
cmake --build build/native
ctest --test-dir build/native --output-on-failure
```

Initialize a runtime state:

```sh
./build/native/horn_traverse init arguments/chinese-room.horn-argument.json
```

Apply a step from files:

```sh
./build/native/horn_traverse step \
  arguments/chinese-room.horn-argument.json \
  state.json \
  operation.json \
  previous-receipt.json
```

The previous receipt is optional for the first step.

## Build with Celix

When Apache Celix is discoverable by CMake, the same configure builds the
contract bundle, engine bundle, and `HornEngineRuntime` container.

The Celix bundle is intentionally thin. It registers `ITraversalService` and
delegates semantics to `horn_engine`; bundle lifecycle and service discovery do
not redefine argument behavior.

## Golden validation

The existing document-validation parity remains intact. Install JS deps, then
run `validate:report` and `golden:validation`. Override the native validator via
`HORN_VALIDATE`.

See ADR-0015 for validation equivalence and ADR-0016 for the Celix engine
boundary.
