# ADR-0004 — The renderer is pure

Status: accepted  
Date: 2026-09-02

## Decision

The first Horn renderer is a pure document renderer:

```text
HornDocument -> SVG + warnings
```

It does not lay out nodes, route relations, rewrite claims, infer missing geometry, or change argument topology.

## Layers

The SVG renderer paints document layers in a deterministic order:

1. regions
2. relation routes
3. relation labels
4. nodes

All coordinates are used directly in authored canvas space.

## Missing geometry

Historical documents with missing relation geometry are invalid before rendering.

Authored documents may be temporarily incomplete while they are being constructed. If an authored relation has no route, the renderer omits the relation and returns an `unrouted-authored-relation` warning. It never draws a synthetic line from the relation endpoints.

## Presentation

The renderer emits semantic classes and data attributes but does not hard-code a Robert E. Horn facsimile theme. `src/render/horn.css` is a deliberately neutral shell using system colors and typographic defaults.

Historical visual styling will be a separate source-backed layer. The kernel must not invent typography, palette, iconography, or arrow grammar and then call it Horn.

## Accessibility and inspection

Rendered murals expose:

- the document title as SVG accessible text
- document authority and ID as data attributes
- node IDs, numbers, kinds, and origins
- relation IDs, kinds, and endpoints

This lets the same SVG serve as an inspectable document surface rather than a flattened image.

## Consequences

- rendering is deterministic for a given document
- layout bugs cannot mutate corpus data
- historical fidelity remains upstream of presentation
- authored tools may generate geometry, but they do so as explicit authoring transforms that persist their results back into `.horn.json`
