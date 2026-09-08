# ADR-0019: Native query equivalence precedes the Horn Celix engine

Status: Proposed

## Context

ADR-0017 defines deterministic Horn structural queries in TypeScript and reserves `IQueryService` for a native provider only after golden equivalence. ADR-0018 builds replayable proofs on top of those query results and explicitly keeps `IProofService` interface-only until the query substrate is equivalent.

Earlier SCUMM3 work demonstrated useful runtime patterns: a deterministic framework-free core, canonical state, explicit transitions, immutable receipts, and presentation adapters that cannot mutate canonical semantics. Those patterns are useful for Horn, but SCUMM3's game ontology is not.

Horn already has Apache Celix as its native composition surface. The clean next step is therefore not to invent a parallel traversal ontology first. It is to make the already-specified deterministic query contract native and prove that the implementation agrees with the reference.

## Decision

Implement `horn-query-request/0.1` -> `horn-query-result/0.1` in a framework-free C++ library and prepare a thin Celix `IQueryService` adapter.

The first native implementation covers exactly the ADR-0017 operations:

- `graph`
- `counterfactual`
- `dominators`
- `min-cut`

It preserves the existing reader-direction rule: canonical Horn relations remain persisted as semantic `response -> earlier claim`; derived dialogue analysis traverses `earlier claim -> response` without rewriting source artifacts.

A checked-in golden harness runs identical document/request pairs through the TypeScript and C++ implementations, canonicalizes parsed JSON, and compares both against the same expected result.

## Celix boundary

`horn_query` owns deterministic query semantics and has no Celix dependency.

`QueryBundleActivator.cc` is the prepared Celix adapter, but normal provider registration remains gated. CMake keeps `HornQueryBundle` disabled by default behind `HORN_ENABLE_UNPROVEN_QUERY_PROVIDER=OFF` until the golden harness is green in a trusted external/local build environment and a later reviewed commit deliberately promotes the provider.

The opt-in switch exists only for controlled lab work. Celix does not become a Horn serialization authority, graph authority, proof authority, or cartographic authority.

## Proof gate

`IProofService` remains unimplemented in this phase.

Only after query golden equivalence is demonstrated should the next native pass port:

1. canonical JSON hashing;
2. dependency witnesses;
3. proof creation;
4. proof verification;
5. golden proof equivalence;
6. Celix proof-service registration.

This ordering preserves ADR-0018 rather than bypassing it.

## SCUMM donor boundary

Horn adopts these runtime ideas from SCUMM3:

- deterministic semantics separate from hosts;
- canonicalized inputs/outputs;
- explicit operation boundaries;
- later receipt/proof chaining;
- presentation as a one-way derived view.

Horn does not adopt rooms, actors, inventory, verbs, game scripts, objectives, SCUMM serialization, or a SCUMM/RUSTBELT runtime dependency.

## Next engine layer

After native query and proof equivalence, Horn can add runtime traversal state around canonical claim identities. That layer may introduce receipt-bearing operations such as entering a claim or following a relation, but it must compose with the proven query/proof substrate rather than redefine it.

Vivisection, Zeppelin, ECharts, SVG, and immersive/3D views then become Celix consumers of deterministic state, proofs, receipts, and immutable Horn artifacts.

## Consequences

- the existing PR stack remains the semantic specification for native work;
- C++ optimization cannot silently diverge from TypeScript behavior;
- Celix becomes the replaceable composition plane, not the semantics owner;
- proof generation stays correctly gated;
- the useful SCUMM runtime architecture is transplanted without importing its game ontology;
- the future Horn engine grows from demonstrated equivalence rather than a parallel model.
