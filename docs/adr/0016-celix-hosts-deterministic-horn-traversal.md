# ADR 0016: Celix hosts a deterministic Horn traversal engine

Status: accepted

## Context

Horn now has two deliberate authorities:

1. `horn-argument/0.1` for geometry-free semantic argument structure.
2. `horn-document/0.1` for authored cartography where spatial arrangement is
   meaning.

Horn also needs a runtime if a reader is going to *enter* an argument rather
than merely render it. The existing SCUMM3 work contains several useful runtime
patterns: a deterministic framework-free core, canonical state, explicit
transitions, immutable receipts, and presentation adapters that cannot mutate
canonical semantics.

Those patterns are useful. SCUMM3's game ontology is not.

Apache Celix is already the native hosting surface for libhorn. It is a better
fit for the runtime composition layer because traversal, projections, evidence,
Vivisection, renderers, and future authoring services can remain independently
replaceable bundles behind explicit service contracts.

## Decision

Horn will implement its native traversal engine in C++ and host it with Apache
Celix.

The engine consumes `horn-argument/0.1`. It does not consume or mutate authored
cartographic geometry.

The pure `TraversalRuntime` has no Celix dependency. Celix owns bundle
lifecycle, service discovery, composition, and replaceable adapters. It does not
own Horn semantics.

The first runtime state is `horn-runtime-state/0.1`:

- argument identity;
- current claim identity;
- optional active stream identity;
- monotonically increasing step;
- normalized set of visited claim identities.

The first operation vocabulary is:

- `enter-claim`;
- `follow-relation`;
- `enter-stream`;
- `leave-stream`;
- `focus-issue`.

Each successful operation produces a normalized effect plus an immutable
`horn-transition-receipt/0.1` containing:

- argument identity;
- canonical operation;
- normalized effect;
- source state SHA-256;
- target state SHA-256;
- optional previous receipt identity.

A previous receipt, when supplied, must verify and terminate at the exact source
state. This makes the runtime history independently inspectable without making
history part of authored Horn truth.

`follow-relation` may traverse either endpoint for navigation. The receipt
records `semantic-forward` or `semantic-reverse`, so navigation never confuses
reader movement with the authored semantic direction of the relation.

Selecting a stream constrains traversal to claims in that stream until the
stream is left or issue focus is restored.

## SCUMM3 donor boundary

Horn deliberately adopts these ideas:

- deterministic core separate from hosts;
- canonical state;
- explicit operation/effect boundary;
- receipt hashing and chaining;
- presentation as a one-way projection.

Horn deliberately does **not** adopt:

- rooms;
- actors;
- inventory;
- verbs;
- scripts as argument semantics;
- game objectives;
- SCUMM serialization;
- SCUMM/RUSTBELT runtime dependencies.

This is a conceptual transplant, not an engine embedding.

## Cartography boundary

`horn-document/0.1` remains the authority for spatial grammar.

A future immersive renderer may use claim identity to bind runtime focus to a
region, camera destination, 3D room, voice, animation, or ECharts view. Those
are presentation adapters. They may observe runtime state but must never write
synthetic geometry or semantic relations back into Horn source artifacts.

This mirrors the existing rule that derived projections never become Horn
authority.

## Celix bundle boundary

`HornEngineBundle` registers `ITraversalService`.

The service interface intentionally keeps JSON at the ABI edge while the
contracts are young. The semantic implementation remains in `horn_engine`,
which can be tested and embedded without a Celix framework.

Later bundles may consume the traversal service to provide:

- Vivisection evidence views;
- Zeppelin laboratory sessions;
- Horn immersive/3D presentation;
- transition telemetry;
- external evidence admission;
- authoring assistants.

Those bundles may enrich observation and presentation. They may not silently
change traversal semantics or authored Horn truth.

## Consequences

Horn gets an actual native engine without becoming a game engine.

The runtime can be replayed and inspected because transitions are deterministic
and receipt-bearing.

Celix becomes the composition plane for future Horn capabilities while the
semantic core remains small enough to reason about and test independently.

SCUMM3 becomes a proven source of runtime patterns rather than a dependency or
ontology.
