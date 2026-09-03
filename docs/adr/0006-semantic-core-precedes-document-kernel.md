# ADR-0006 — Semantic core precedes the document kernel

Status: proposed  
Date: 2026-09-02

## Context

`horn-document/0.1` correctly treats authored geometry, relation routes, authority, and provenance as semantic document data. That format is the cartographic representation of a finished historical or authored mural.

Robert E. Horn's *Introduction to Argumentation Mapping* exposes an earlier transformation that the document kernel does not model: source selection, passage analysis, claim extraction, claim normalization, issue typing, argument streams, focus claims, and submaps.

Trying to force both concerns into one format creates a false choice between two valid requirements:

- argument semantics should exist independently of poster geometry;
- finished Horn documents must preserve geometry as meaning.

## Decision

Add a semantic layer before `horn-document/0.1`.

The pipeline is:

```text
sources
  -> passages
  -> horn-semantic/0.2
  -> cartographic authoring / compilation
  -> horn-document/0.1 (or successor)
  -> renderer
```

`horn-semantic/0.2` models the argument recovered from sources. Its base argumentative relations are `supports` and `disputes`. Toulmin roles such as position, ground, warrant, backing, and rebuttal are claim annotations.

`horn-document/0.1` remains the authored visual document layer. Geometry remains semantic there. Historical geometry is never inferred or repaired by automatic layout.

The document layer may preserve richer source-derived cartographic relation kinds such as `warrants`, `addresses`, and `interprets-as`. Those do not expand the base graph algebra of the semantic core; they are introduced by cartographic interpretation or by source-faithful document reconstruction.

## Consequences

- The existing document kernel and renderer remain valid.
- The semantic compiler can normalize argument structure without inventing geometry.
- A single semantic debate can later project to outline, tree, graph, web, or authored mural forms.
- Cartographic authorship remains explicit rather than being hidden inside an automatic layout step.
- The semantic and document schemas can evolve independently while preserving a defined compilation boundary.
- The cloning terminology fixture becomes the first semantic conformance specimen.

## Non-decision

This ADR does not define the compiler from semantic IR to `horn-document`, automatic claim extraction, or automatic map layout. In particular, it does not authorize a renderer to invent historical geometry.
