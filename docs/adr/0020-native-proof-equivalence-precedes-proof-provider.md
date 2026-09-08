# ADR-0020: Native proof equivalence precedes proof-provider promotion

Status: Proposed

## Context

ADR-0017 defines deterministic Horn queries and requires TypeScript/native golden equivalence before a native query provider becomes normal authority. ADR-0018 defines replayable query proofs and reserves `IProofService` until that query substrate is equivalent and proof output has its own golden coverage. ADR-0019 ports the query kernel to framework-free C++ and keeps the Celix query adapter explicitly gated.

The next native layer is therefore proof composition, not a new reasoning ontology.

A Horn proof makes a narrow claim: for one canonical Horn document, one versioned deterministic query, and one replay algorithm, it binds the exact structural answer, the full source digest, the query-relevant dependency witness, and a content-addressed proof identity. It does not prove that a philosophical claim is true.

## Decision

Port `horn-proof/0.1` and `horn-proof-verification/0.1` to a framework-free C++ `horn_proof` library that composes the existing `horn_query` kernel.

The native implementation must reproduce the TypeScript reference behavior for:

- recursively key-ordered canonical JSON over Horn contract values;
- SHA-256 full-document digests;
- `horn-query-dependencies/0.1` witnesses;
- dependency-witness SHA-256 digests;
- deterministic query result embedding;
- `horn-proof:<sha256>` content addressing;
- verification issue codes and ordering.

The standalone `horn_proof` CLI exposes `create` and `verify` modes so conformance can be demonstrated without Apache Celix.

## Golden rule

`golden/proof/compare.mjs` is the promotion gate.

For each checked-in case it:

1. runs proof creation through the TypeScript reference;
2. runs the same document/request through native C++;
3. requires canonical equality of the complete proof objects;
4. requires the checked-in proof ID, source digest, and dependency digest;
5. replays the exact same proof through both verifiers;
6. requires canonical equality of the verification reports.

A native proof provider is not promoted merely because the C++ tests pass. The cross-language golden must be green in the trusted local/external build environment.

## Celix boundary

`ProofBundleActivator.cc` is a prepared adapter only.

`HornProofBundle` remains disabled by default behind `HORN_ENABLE_UNPROVEN_PROOF_PROVIDER=OFF`. Lab construction also requires `HORN_ENABLE_UNPROVEN_QUERY_PROVIDER=ON`; CMake rejects proof-provider enablement without the query provider.

This makes the dependency order executable rather than documentary:

```text
reference query contract
        |
        v
native query equivalence
        |
        v
reference proof contract
        |
        v
native proof equivalence
        |
        v
Celix proof-provider promotion
```

Celix owns lifecycle and composition only. It does not become source authority, proof authority, cartographic authority, or a second semantic definition of Horn.

## Canonicalization boundary

Horn proof hashing applies to JSON-compatible contract artifacts. Native canonicalization uses the key-ordered JSON representation and is judged by exact content-addressed equality against the TypeScript reference.

If future Horn contracts introduce numeric or string cases whose JSON serialization differs across runtimes, the correct response is to add a failing cross-language fixture and narrow the canonicalization contract explicitly before promotion. Silent runtime-specific hashing is not acceptable.

## SCUMM donor boundary

This layer continues the useful SCUMM3 transplant:

- deterministic core separate from host lifecycle;
- immutable, content-addressed evidence;
- explicit replay boundary;
- derived presentation that cannot mutate canonical state.

It does not import rooms, actors, inventory, verbs, game scripts, objectives, SCUMM serialization, or a RUSTBELT runtime dependency.

## Next engine layer

Once query and proof equivalence are demonstrated and their Celix providers are deliberately promoted, Horn can add receipt-bearing traversal around canonical claim and relation identities.

That runtime layer may record actions such as entering a claim or following a relation, but the receipts must point back to the proven query/proof substrate rather than create a parallel truth system.

Vivisection then becomes a read-only consumer of those artifacts: inspect traversal state, proof dependencies, provenance, gaps, and reconstruction boundaries without mutating or authorizing execution.

## Consequences

- proof portability becomes testable across TypeScript and C++;
- content-addressed proof identity becomes a hard conformance target;
- native proof registration cannot outrun query equivalence;
- WindAnvil can later admit Horn proofs as evidence without becoming Horn semantic authority;
- the path to receipt-bearing traversal and Vivisection stays deterministic and evidence-first.
