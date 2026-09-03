# ADR-0005 — The camera moves the window, not the mural

Status: accepted  
Date: 2026-09-02

## Decision

Navigation in Horn changes only the SVG `viewBox`. Pan, zoom, and focus never mutate node, region, or relation coordinates in the `HornDocument`.

## Why

The document’s authored geometry is semantic data. Interaction must therefore be modeled as a camera over a stable mural rather than as transforms that rewrite or relayout document objects.

This distinction matters for historical material: the same `.horn.json` must produce the same spatial document regardless of how a reader enters, pans, zooms, or focuses it.

## Camera model

The camera owns a view rectangle in document units:

```text
x, y, width, height
```

The initial view is the complete authored canvas. Operations are:

- `pan(dx, dy)` — move the view in document units, clamped to the canvas
- `zoom(factor, anchor)` — zoom around a document-space anchor
- `focus(rect)` — frame an authored rectangle with padding while preserving mural aspect ratio
- `reset()` — return to the full canvas

Zoom-out is bounded by the full mural. Zoom-in is bounded by a configurable maximum scale.

## Interaction controller

The browser controller maps:

- pointer drag → pan
- wheel / trackpad → anchored zoom
- double-click on a node → focus that node
- arrow keys → pan
- `+` / `-` → zoom
- `0` / `Home` → reset

The controller changes the SVG `viewBox` only.

## Consequences

- camera history can later be serialized independently of corpus data
- deep links can point to a node or view without creating a new document
- multiple readers can navigate the same immutable mural differently
- renderer output remains deterministic while interaction remains fluid
