# ADR 0006: ECharts is an analytical projection

## Status

Accepted.

## Context

Horn documents encode mapped argument as authored visual language. Node geometry and relation routes are document semantics, not hints for a generic graph layout. The historical mural renderer therefore paints authored coordinates and authored routes directly.

Interactive analysis needs a different capability. A reader may want to inspect the same argument as topology, chronology, or provenance without editing the mural or pretending that those derived layouts are Horn's authored cartography.

Apache ECharts is a strong fit for those derived views, but only if the architectural boundary is explicit.

## Decision

ECharts is an **analytical projection layer** over a `HornDocument`. It is not the canonical Horn renderer and it never owns Horn document state.

The first projection set contains three views:

1. **Argument** — a graph projection that places nodes at the centers of their authored Horn rectangles, while intentionally abstracting authored relation routes into analytical edges.
2. **Timeline** — a chronological scatter projection of dated nodes.
3. **Evidence** — a derived source-to-claim network across mapped and cartographic citation layers. This view may use an ECharts force layout because the layout is explicitly analytical, not cartographic.

All projections are derived in memory from the canonical `HornDocument`. They do not mutate it, write geometry back into it, or provide a round-trip serialization path from ECharts to `.horn.json`.

The canonical mural remains the SVG renderer in `src/render/`. Historical route geometry remains authoritative there.

## Invariants

- A Horn document is the source of truth.
- ECharts options are disposable derived state.
- Projection code must not mutate the source document.
- Projection layouts must never be persisted as Horn geometry unless a separate authoring operation explicitly creates new Horn document data.
- Analytical graph edges must not be presented as reconstructed Horn routes.
- Historical cartography and analytical views must remain visually and semantically distinguishable.
- Stable Horn node and citation IDs should be carried into projections so selections can later synchronize across views without changing document identity.
- The SVG mural remains the reference view for authored spatial grammar.

## Consequences

Horn can support multiple interactive ways of interrogating the same argument without becoming a generic graph viewer. ECharts can provide zooming, filtering, emphasis, data zoom, force-directed provenance inspection, and future coordinated views while the document kernel stays renderer-independent.

This also keeps other future renderers open. Three.js, Godot, print, notebook, or assurance-oriented projections can consume the same Horn document without adopting ECharts as the knowledge model.
