# ADR-0002 — Horn document invariants

Status: accepted  
Date: 2026-09-02

## Decision

`horn-document/0.1` is a document format for authored visual argument, not a generic graph serialization. Geometry, authority, and provenance are therefore semantic data and are validated as such.

## Authority

A document has exactly one authority:

- `historical` — recovered historical geometry and content. It contains no authored nodes and no `after` metadata.
- `authored` — a reconstruction or new work in Horn’s language. It declares `after` and contains at least one node whose origin is `authored`.

Authored material must never be silently inserted into a historical document.

## Provenance

Horn carries two citation layers.

### Layer A — mapped

Layer A identifies the published debate material represented by a debate node. Every node with `origin: debate` must cite at least one `mapped` citation.

### Layer B — cartographic

Layer B identifies the cartographic method and sources governing how the mural is drawn. It belongs primarily to the document, so every document must contain at least one `cartographic` citation. A node cites Layer B directly only when a cartographic claim or authored overlay applies specifically to that node.

This avoids repeating the same Horn citation hundreds of times while preserving the distinction between what an argument says and how the argument was mapped.

## Geometry

Spatial arrangement is meaning. The validator therefore rejects:

- non-finite or non-positive canvas dimensions
- non-finite coordinates
- zero or negative node/region dimensions
- node or region rectangles extending outside the canvas

Historical geometry is never repaired by automatic layout.

## Identity and topology

The validator requires unique node IDs, claim numbers, relation IDs, region IDs, and citation IDs. Relations must resolve both endpoints and may not point a node at itself. Reading paths must resolve existing nodes and may not repeat a node.

Claim numbers are identity only. They are not topological order.

## Vocabulary

The core relation vocabulary is:

- `supports`
- `disputes`
- `warrants`
- `addresses`
- `interprets-as`

`interprets-as` is source-derived from Horn’s maps and must not be collapsed into support or dispute.

The core node vocabulary includes argument roles plus source-derived mural objects such as issue areas, focus claims, implemented/proposed models, postulate sets, definitions, sidebars, thought experiments, dilemmas, unmapped territory, cross-references, and supplemental artifacts.

Experimental node and relation kinds use the `x-*` namespace. A kind joins the core only when the corpus or language contract justifies it.

## Consequences

- A pure historical document can validate without any authored gloss.
- An authored reconstruction cannot masquerade as a historical map.
- Renderers may trust geometry as authored input rather than recomputing layout.
- Consumers can distinguish debate provenance from cartographic provenance.
- The format can grow without weakening `horn-document/0.1` into arbitrary strings.
