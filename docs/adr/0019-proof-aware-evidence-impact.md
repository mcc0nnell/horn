# ADR-0019: Proof-aware evidence impact

Status: Proposed

## Context

Horn already has physical-evidence fingerprinting and narrow evidence-to-node bindings. ADR-0018 adds replayable structural query proofs.

Those two mechanisms answer different questions:

- a Horn query proof says that a structural result replays from a particular Horn document;
- an evidence binding says that a Horn node depends on a captured external factual substrate.

If external evidence changes, the authored Horn document must not be silently rewritten and a structurally replayable proof must not be mislabeled as cryptographically invalid. What changes is the evidence status of the nodes that the proof consulted.

## Decision

Introduce `horn-evidence-impact/0.1` as a derived overlay.

Given:

- a canonical Horn document;
- the existing physical evidence snapshot;
- the existing evidence bindings;
- zero or more deterministic Horn query requests;

produce a report containing:

- changed evidence invalidations;
- the union of stale node identities;
- binding identities that no longer resolve in the Horn document;
- each query's proof id and structural dependency digest;
- the stale dependency nodes, if any, touched by that query;
- an `affected` flag.

## Critical distinction

`affected: true` does **not** mean the query result is structurally false.

It means that at least one Horn node consulted by the query is bound to physical evidence whose observed fingerprint no longer matches the recorded expected fingerprint.

The structural proof may still replay successfully against the unchanged Horn document.

This produces two orthogonal axes:

```text
                     evidence current     evidence changed

proof replays        current result        affected result

proof fails replay   structural drift      structural + evidence drift
```

Keeping those states separate prevents evidence changes from being confused with document mutation or query-engine drift.

## No transitive truth inference

This pass does not infer that a stale node makes an earlier or later claim false, unsupported, or defeated.

It reports dependency contact only.

Any future transitive impact rule must be introduced explicitly at the correct semantic layer and calibrated against Horn source evidence. Reader-facing graph reachability alone is not sufficient justification for truth propagation.

## Unknown binding identities

If an invalidated evidence binding names a Horn identity absent from the supplied document, the report preserves that identity under `unknownBoundNodeIds`.

It is not silently dropped or remapped.

## Native boundary

Do **not** add a native `IImpactService` yet.

The current evidence snapshot and evidence binding shapes predate the artifact-versioning discipline used by libhorn query/proof contracts. Freezing a native service around those unversioned inputs would create the wrong ABI boundary.

Before native evidence impact:

1. version the evidence snapshot contract;
2. version the evidence binding contract;
3. establish TypeScript golden fixtures;
4. then define an artifact-based Celix service and prove native equivalence.

## Consequences

- an external evidence change can identify exactly which deterministic Horn analyses touch stale nodes;
- unchanged structural proofs remain independently verifiable;
- Horn claims remain authored state rather than being rewritten by evidence machinery;
- broken evidence bindings stay observable;
- the next native step is forced to version evidence artifacts instead of smuggling TypeScript object shapes into the C++ ABI.
