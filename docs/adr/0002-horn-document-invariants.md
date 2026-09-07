# ADR-0002: Horn document invariants

Status: Accepted

## Context

`horn-document/0.1` is the authored cartographic representation of a Horn argument. It preserves the visual and provenance decisions that cannot be recovered from semantic structure alone.

The semantic layer is defined separately by ADR-0007. These invariants therefore apply specifically to cartographic documents.

## Decision

A valid Horn document must preserve the following invariants.

### Identity

- node ids are unique;
- relation ids are unique;
- region ids are unique;
- citation ids are unique;
- claim numbers are unique.

When a debate node realizes a claim from `horn-argument/0.1`, the semantic claim id should survive cartography unchanged. Cross-layer correspondence is validated separately by `src/correspondence.ts`.

### Geometry

- canvas width and height are positive finite numbers;
- node and region rectangles are positive finite geometry;
- node and region geometry stays within the authored canvas;
- historical relation geometry is authored evidence and must not be synthesized.

### Relations

- every relation endpoint exists;
- relations may not be self-relations;
- historical relations require authored route geometry;
- cartographic `warrants` roads may realize semantic warrants attached to support moves as defined by ADR-0008.

### Reading path

- reading-path identities exist;
- the path does not repeat identities;
- the path is cartographic guidance, not a substitute for semantic argument streams.

### Provenance

Horn keeps mapped and cartographic provenance distinct.

- every debate node has mapped-source provenance;
- every document has cartographic provenance;
- authored overlays are explicitly marked as authored and have cartographic provenance;
- historical and authored authority must never be silently mixed.

### Authority

A historical document contains no authored nodes and no `after` metadata.

An authored document declares `after` and contains at least one explicitly authored node. Authored reconstruction may preserve source-derived argument content while remaining clear that the cartography itself was produced after Horn.

## Consequences

The document validator protects the mural as an authored artifact rather than treating it as a disposable rendering of a generic graph.

Semantic validity does not imply cartographic validity, and cartographic validity does not by itself prove semantic correspondence. Both layers have their own contracts.
