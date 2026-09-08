# ADR-0018: Zeppelin composition is ephemeral derived state

- Status: Superseded in composition ownership by ADR-0019; authority constraints retained
- Date: 2026-09-08

## Context

ADR-0016 makes libhorn analysis derived and disposable. ADR-0017 pins Apache Celix as the runtime mechanism without making Celix semantic authority. The native `%horn` interpreter can now invoke the individual validation, projection, query, explanation, impact, and diff services through that pinned service plane.

A reasoning notebook becomes substantially more useful when one paragraph can feed a result into a later paragraph. That convenience creates an authority risk: a counterfactual, projection, query result, explanation, or impact report must not silently become an authored HORN document merely because a notebook can name it.

## Original decision

The first composition implementation treated Zeppelin as the owner of ephemeral derived state. The `%horn` interpreter could bind a successful Celix-backed JSON result with:

```text
%horn let <name> = <analysis-command>
```

Later paragraphs could reference the complete value as `@name` or select a value using JSON Pointer syntax as `@name#/path/to/value`.

The following authority constraints remain normative after ADR-0019:

1. bindings are scoped to one Zeppelin note from the UI perspective;
2. rerunning a `let` paragraph replaces the corresponding ephemeral binding;
3. note export serializes paragraphs, not bound values;
4. imported notes reconstruct bindings only by rerunning producing paragraphs;
5. a binding or selector may **never** satisfy a canonical HORN document operand;
6. canonical document operands continue to originate from repository-relative `.horn.json` files in the Zeppelin adapter;
7. composition does not add Horn relations, rewrite authored geometry, admit evidence, or become serialization authority;
8. binding metadata is derived-state metadata, not evidence admission.

ADR-0019 moves binding resolution, replacement, JSON Pointer semantics, digests, and service dispatch out of Zeppelin and into `horn::IReasoningSessionService`. Zeppelin now retains only the returned opaque session envelope for the note.

## Consequences

A notebook can still express chains such as:

```text
%horn let lookup = query maps/chinese-room-slice.horn.json golden/reactor/queries/node-lookup.json
%horn let explanation = explain maps/chinese-room-slice.horn.json @lookup#/node/id
%horn bindings
```

without changing the source document or inventing a second persistence model.

This deliberately does not provide a way to turn a counterfactual result into a new canonical HORN document. If such promotion is ever required, it must be an explicit authored/admission workflow with its own contract and provenance rules rather than a notebook convenience.

The `%horn let` grammar remains a Zeppelin interaction syntax. The semantics of composing its derived results now belong to the Celix reasoning-session contract defined by ADR-0019.
