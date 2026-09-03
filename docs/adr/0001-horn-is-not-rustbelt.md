# ADR-0001: Horn is not RUSTBELT

Status: Accepted

## Context

Horn and RUSTBELT solve different problems.

Horn is an argumentation system. It owns source-derived argument meaning, claim identity, provenance, authored cartography, and the transformations that connect those layers.

RUSTBELT is a deterministic Java 21 execution kernel. It owns state, operations, effects, receipts, conformance, and runtime behavior.

The systems may interoperate, but neither is an implementation detail of the other.

## Decision

Horn does not live inside RUSTBELT, and RUSTBELT does not define Horn semantics.

The boundary is explicit:

```text
Horn source corpus
      |
      v
horn-argument/0.1
      |
      v
authored cartography
      |
      v
horn-document/0.1
      |
      v
derived projection
      |
      v
target adapter
      |
      v
RUSTBELT typed IR
      |
      v
Java kernel
```

A Horn projection may select semantic or cartographic identities for use by RUSTBELT. The RUSTBELT adapter decides how those identities become executable state or operations.

Execution semantics never flow back into Horn merely because a Horn artifact can be executed by a target.

A RUSTBELT receipt may cite the Horn source and projection used to produce an executable artifact. That receipt is derived evidence; it does not mutate or supersede Horn authority.

## Consequences

Horn remains usable for historical reconstruction, argument analysis, authored visual reasoning, and other consumers that have nothing to do with games or simulation.

RUSTBELT remains usable with content that did not originate in Horn.

The former world-graph concept nicknamed “Horn Fabric” does not define this relationship and should not be treated as Horn's ontology.

Shared low-level libraries are possible later, but shared implementation does not collapse the conceptual boundary.
