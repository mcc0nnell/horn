# ADR-0018: Zeppelin composition is ephemeral derived state

- Status: Accepted
- Date: 2026-09-08

## Context

ADR-0016 makes libhorn analysis derived and disposable. ADR-0017 pins Apache Celix as the runtime mechanism without making Celix semantic authority. The native `%horn` interpreter can now invoke the individual validation, projection, query, explanation, impact, and diff services through that pinned service plane.

A reasoning notebook becomes substantially more useful when one paragraph can feed a result into a later paragraph. That convenience creates an authority risk: a counterfactual, projection, query result, explanation, or impact report must not silently become an authored HORN document merely because a notebook can name it.

## Decision

Zeppelin composition is an adapter concern and is explicitly **ephemeral derived state**.

The `%horn` interpreter may bind a successful Celix-backed JSON result with:

```text
%horn let <name> = <analysis-command>
```

Later paragraphs may reference the complete value as `@name` or select a value using JSON Pointer syntax as `@name#/path/to/value`.

The following constraints are normative for the Zeppelin adapter:

1. bindings are scoped to one Zeppelin note;
2. rerunning a `let` paragraph replaces that note-local binding;
3. bindings are held in interpreter memory only and are cleared when the interpreter closes;
4. note export serializes paragraphs, not bound values;
5. imported notes reconstruct bindings only by rerunning the producing paragraphs;
6. derived JSON may be materialized to an operating-system temporary file only when an existing native service already accepts a JSON file operand;
7. those temporary files are deleted after the invocation;
8. scalar selectors may feed scalar service operands such as an explanation identity;
9. a binding or selector may **never** satisfy a canonical HORN document operand;
10. canonical document operands continue to resolve only to repository-relative `.horn.json` files;
11. the composition layer does not add Horn relations, rewrite authored geometry, or become semantic authority;
12. `%horn bindings` may expose derived-state metadata such as name, producing command, contract version, and digest, but that metadata is not evidence admission.

## Consequences

A notebook can express chains such as:

```text
%horn let lookup = query maps/chinese-room-slice.horn.json golden/reactor/queries/node-lookup.json
%horn let explanation = explain maps/chinese-room-slice.horn.json @lookup#/node/id
%horn bindings
```

without changing the source document or inventing a second persistence model.

This deliberately does not provide a way to turn a counterfactual result into a new canonical HORN document. If such promotion is ever required, it must be an explicit authored/admission workflow with its own contract and provenance rules rather than a notebook convenience.

The composition grammar belongs to Zeppelin, not to `horn-document/0.1`, `horn-query/0.1`, or any other libhorn semantic contract.
