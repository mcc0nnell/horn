# ADR-0003 — Relation geometry is authored

Status: accepted  
Date: 2026-09-02

## Decision

A relation in a Horn document may carry an authored `route`. Historical relations must carry one.

The renderer must never synthesize, optimize, straighten, or otherwise replace a historical relation route from node endpoints alone.

## Why

Horn’s arrows are not generic graph edges. Their paths participate in the mural’s grammar: they create streams, shared roads, visual grouping, and reading cadence. In the recovered *Can Computers Think?* maps, long relation spines routinely pass near unrelated claims before terminating at their actual source or focus claim. Endpoint proximity is therefore not a safe substitute for authored path geometry.

A renderer that draws a straight line from `from` to `to` would preserve graph topology while destroying the document.

## Route representation

`horn-document/0.1` stores route geometry as canvas-space path commands:

- `M` — move
- `L` — line
- `Q` — quadratic Bézier
- `C` — cubic Bézier
- `Z` — close

A route may also carry `labelGeometry` for the authored placement of its relation label.

This command vocabulary is deliberately close to vector source material without embedding an opaque SVG path string. It can be rendered to SVG, Canvas, PDF, or another vector target.

## Validation

The validator requires historical relations to have a route and checks that:

- the route begins with `M`
- it contains at least one drawable segment
- command endpoints are finite and remain in the document canvas
- Bézier control points are finite
- relation-label geometry, when present, remains inside the canvas

Authored documents may temporarily contain unrouted relations while being constructed. Before an authored mural is frozen or published as a finished visual document, its relation routes should be authored and persisted.

## Shared roads

The original maps sometimes use visually shared spines. Version 0.1 permits relation routes to duplicate shared path geometry rather than prematurely normalizing it into a separate road graph. A future format may introduce reusable path segments if the corpus proves that abstraction useful.

Source fidelity comes before deduplication.

## Consequences

- Historical renderers are render-only with respect to relation layout.
- Graph layout libraries may not rewrite historical relation paths.
- Importers must recover arrow geometry as well as relation endpoints.
- The renderer can refuse or visibly flag missing historical geometry rather than inventing it.
