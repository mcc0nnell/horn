# ADR-0021: Horn tapes record traversal, not truth

## Status

Proposed.

## Context

Horn now has deterministic query artifacts, replayable query proofs, and a prepared native C++/Celix proof surface. The next runtime slice needs to preserve how a reader or tool moves through canonical Horn identities without turning presentation state, a user's beliefs, or a derived interpretation into authored Horn truth.

The immediate architectural inspiration is the broader tape pattern: capture an observed event sequence once and replay it through the same deterministic boundary later. In Horn, the relevant observed sequence is a traversal through nodes, relations, and citations.

Horn already distinguishes semantic relation direction from reader direction. Persisted relations point `response -> earlier claim`; reader traversal moves `earlier claim -> response`. A replay artifact must preserve that distinction explicitly.

## Decision

Introduce three versioned artifacts:

- `horn-tape-plan/0.1` — requested traversal actions;
- `horn-tape/0.1` — normalized, receipt-chained traversal events bound to one exact canonical Horn document;
- `horn-tape-verification/0.1` — deterministic replay result.

A v0 tape may record only:

- `focus-node` — an explicit navigation jump to a canonical node identity;
- `follow-relation` — a reader-direction traversal over a canonical relation identity;
- `open-citation` — access to a citation attached to the currently focused node;
- `checkpoint` — a non-semantic label attached to the current traversal state.

Every event receives a monotonically increasing logical sequence number, a previous-receipt digest, and its own canonical SHA-256 receipt digest. The first event is chained to a genesis digest that binds the document identity, the exact canonical document digest, and reader-direction replay semantics. The terminal digest is therefore a compact receipt for the entire traversal sequence.

The tape itself is content-addressed as `horn-tape:<sha256>`.

## Authority boundary

A Horn tape is **derived evidence about traversal**. It is not authored Horn content and must never silently mutate claims, warrants, rebuttals, relation semantics, citations, authored geometry, source correspondence, or truth status.

This first contract intentionally does **not** record interpretation, agreement, disagreement, emotional response, or inferred conclusion. Those may later become separate derived artifacts after their semantics are explicit enough to version.

A UI may render a tape as a guided tour, animation, 3D walk, narrated path, or analytical trace. Those renderings remain consumers of the tape, not authorities over the canonical Horn document.

## Replay semantics

Live traversal and tape replay must meet at the same canonical identity boundary:

```text
interactive UI / agent / guided tour
              |
              v
      horn-tape-plan/0.1
              |
              v
 canonical Horn identities
              |
       receipt recorder
              |
              v
        horn-tape/0.1
              |
      deterministic replay
              |
              v
horn-tape-verification/0.1
```

For `follow-relation`, replay verifies that the currently focused node equals the persisted relation's `to` endpoint and advances to the relation's `from` endpoint. This preserves ADR-0007 rather than inventing a second relation model.

For `open-citation`, replay verifies both that the citation exists and that the currently focused node actually names it in `citationIds`.

`focus-node` is deliberately allowed to jump. A reader can click elsewhere on a map; the tape should preserve that jump rather than pretending it was an argument edge.

## Native/Celix boundary

Reserve `ITapeService` and the tape contract constants in `RuntimeServices.h`, but do not register a native provider yet.

The TypeScript implementation is the reference contract for this pass. A C++ provider must earn authority through the same TypeScript/native golden-equivalence discipline already established for queries and proofs. PR #22's query/proof equivalence gates remain prerequisites.

## Consequences

Horn gains a deterministic temporal dimension without turning itself into a game runtime or importing RUSTBELT/SCUMM world semantics.

The same canonical map can now support many independent tapes: expert tours, learner paths, debugging traces, automated query walks, historical walkthroughs, and later counterfactual branches.

A tape can be preserved, diffed, replayed, or rejected after source drift. Because it is bound to the exact canonical document digest, a changed Horn document cannot quietly impersonate the world in which the traversal originally occurred.

## Next

1. Prove TypeScript tape recording and replay locally/external-CI.
2. Add a checked-in golden tape corpus using real Horn specimens.
3. After PR #22's proof equivalence gate is green, port `ITapeService` to the native C++ kernel and establish byte-for-byte golden equivalence.
4. Feed tapes one-way into Vivisection, Zeppelin, ECharts, SVG, and immersive viewers.
5. Only then consider branch/counterfactual and interpretation-layer tape artifacts.
