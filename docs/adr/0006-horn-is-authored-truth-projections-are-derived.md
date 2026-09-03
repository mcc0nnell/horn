# ADR-0006: Horn is authored truth; projections are derived

Status: Accepted

## Context

Horn now contains a portable authored document with claims, sources, provenance, typed relations, authored geometry, and reading paths. Other systems may want to consume a subset of that structure. RUSTBELT is the first concrete example: it may interpret selected Horn nodes and relations as inputs to a deterministic executable model.

That does **not** make Horn a game engine, and it does not make RUSTBELT part of the Horn document format.

If a consumer rewrites a Horn document into its own ontology and calls the result Horn, authority becomes ambiguous. Historical geometry can be lost, consumer-specific semantics can leak back into the source, and derived artifacts can become indistinguishable from authored evidence.

## Decision

A valid `.horn.json` document is authored truth.

Consumers derive **projections** from that document. A projection is a separate artifact that:

- identifies exactly one source Horn document and version;
- names a target consumer or projection kind;
- lists the source node and relation identities it consumes;
- may carry target-specific configuration only in its own extension namespace;
- never modifies, replaces, or silently augments the source Horn document;
- never asserts new historical authority merely because a consumer can execute or visualize it.

The first interchange format is `horn-projection/0.1`, defined in `schema/horn-projection-0.1.schema.json`.

A projection manifest is deliberately small. It does **not** define RUSTBELT operations, state transitions, Camel routes, policy rules, rendering behavior, or any other target semantics. Those belong to the target adapter or target repository.

## Architecture

```text
                     Horn document
                  authored / historical truth
                           |
                           v
                 validated identities
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
         document       analysis       RUSTBELT
        projection     projection      projection
             |                           |
             v                           v
         SVG / web                  target adapter
                                         |
                                         v
                                  RUSTBELT typed IR
                                         |
                                         v
                                   Java Kernel
```

The arrow is one-way with respect to authority. A RUSTBELT receipt may cite the Horn document and projection that produced an executable artifact, but the receipt does not mutate Horn.

## Projection identity

A projection is addressable and reviewable independently of its source. Its minimum identity is:

```json
{
  "id": "chinese-room-rustbelt",
  "version": "horn-projection/0.1",
  "source": {
    "documentId": "chinese-room-slice",
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

1. the source document identity or version does not match the document being projected;
2. a listed node or relation does not exist in the source;
3. a listed relation has an endpoint outside the selected node set, unless the target adapter explicitly declares and validates a wider dependency closure;
4. the projection attempts to treat target-specific output as historical Horn authority.

The base manifest schema can enforce shape. Resolution invariants require code because they depend on the source document.

## Consequences

Horn can become the common authored graph without becoming a universal runtime.

RUSTBELT can consume Horn without depending on Horn's renderer, camera, or historical presentation rules. Conversely, Horn does not depend on the RUSTBELT kernel.

Future consumers can define their own projection adapters while sharing the same source identities and provenance boundary.

This ADR refines, but does not reverse, ADR-0001. Horn is still not RUSTBELT. The relationship is now explicit: **Horn describes; a projection selects; the target interprets.**
