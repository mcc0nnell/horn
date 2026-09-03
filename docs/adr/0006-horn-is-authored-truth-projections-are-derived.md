# ADR-0006: Horn is authored truth; projections are derived

Status: Accepted

## Context

Horn contains authoritative source-derived argument structure and authored cartography. Other systems may want to consume a subset of that structure. RUSTBELT is the first concrete example: it may interpret selected Horn identities as inputs to a deterministic executable model.

That does **not** make Horn a game engine, and it does not make RUSTBELT part of either Horn core representation.

If a consumer rewrites Horn into its own ontology and calls the result Horn, authority becomes ambiguous. Historical geometry can be lost, consumer-specific semantics can leak back into the source, and derived artifacts can become indistinguishable from authored evidence.

## Decision

Horn source artifacts are authoritative. Consumers derive **projections** from them.

The first interchange format is `horn-projection/0.1`, defined in `schema/horn-projection-0.1.schema.json`. It currently projects from `horn-document/0.1` while the newer semantic `horn-argument/0.1` layer stabilizes.

A projection is a separate artifact that:

- identifies exactly one Horn source artifact and version;
- names a target consumer or projection kind;
- lists source identities it consumes;
- may carry target-specific configuration only in its own extension namespace;
- never modifies, replaces, or silently augments the Horn source;
- never asserts new historical authority merely because a consumer can execute or visualize it.

A projection manifest does **not** define RUSTBELT operations, state transitions, Camel routes, policy rules, rendering behavior, or any other target semantics. Those belong to the target adapter or target repository.

## Architecture

```text
source corpus
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
projection manifest
     |
     +------------+-------------+
     |            |             |
     v            v             v
  analysis     RUSTBELT      other target
                  |
                  v
            target adapter
                  |
                  v
            target-native IR
```

The arrow is one-way with respect to authority. A target receipt may cite the Horn artifact and projection that produced an executable artifact, but the receipt does not mutate Horn.

## Projection identity

A projection is addressable and reviewable independently of its source. The current document-based manifest uses:

```json
{
  "id": "chinese-room-rustbelt",
  "version": "horn-projection/0.1",
  "source": {
    "documentId": "horn:authored:2026:chinese-room",
    "documentVersion": "horn-document/0.1"
  },
  "target": "rustbelt",
  "nodes": ["c5-chinese-room"],
  "relations": []
}
```

The manifest references Horn identities; it does not copy node text, geometry, citations, or relation content. Consumers resolve those identities against the validated source document.

## Invariants

A projection resolver must reject a manifest when:

1. the source identity or version does not match the artifact being projected;
2. a listed identity does not exist in the source;
3. a listed relation has an endpoint outside the selected node set, unless the target adapter explicitly declares and validates a wider dependency closure;
4. the projection attempts to treat target-specific output as Horn authority.

The base manifest schema can enforce shape. Resolution invariants require code because they depend on the source artifact.

## Consequences

Horn can become the common authored graph without becoming a universal runtime.

RUSTBELT can consume Horn without depending on Horn's renderer, camera, or historical presentation rules. Conversely, Horn does not depend on the RUSTBELT kernel.

Future projection revisions may select directly from `horn-argument/0.1` when a consumer needs semantic structure but not cartography. That extension should preserve the same authority rule: **Horn describes; a projection selects; the target interprets.**

This ADR refines, but does not reverse, ADR-0001. Horn is still not RUSTBELT.
