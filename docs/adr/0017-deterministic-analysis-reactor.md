# ADR-0017: Deterministic analysis reactor

Status: Proposed

## Context

Horn already distinguishes authored cartography from derived analytical views. `libhorn` also has an artifact-first native boundary so that C++ service lifecycle can advance without freezing a second domain ontology.

The next capability is not another renderer. It is a deterministic analysis plane that can answer structural questions about a Horn document while preserving the document as immutable authority.

Examples include:

- which dialogue objects remain reachable from a focus;
- what frontier changes under a hypothetical suppression;
- which nodes occur on every path to a target;
- what smallest internal node set disconnects a target from a focus.

These are graph-theoretic consequences of explicit Horn relations. They are not judgments about whether a claim is true.

## Decision

Introduce versioned artifact contracts:

- `horn-query-request/0.1`
- `horn-query-result/0.1`

The TypeScript implementation is the reference surface for the first deterministic query operations:

- `graph`
- `counterfactual`
- `dominators`
- `min-cut`

The native ABI reserves `horn::IQueryService`, consuming canonical Horn document JSON plus a query-request artifact and returning a query-result artifact.

A native provider does not become authoritative merely because the interface exists. It must first demonstrate golden equivalence against the TypeScript reference.

## Dialogue direction

`HornDocument` relations preserve semantic response direction: the responding node is `from` and the earlier node is `to`.

Reader-facing deterministic analysis walks the reverse direction:

```text
relation.to -> relation.from
 earlier       response
```

This matches the existing Horn thread derivation rule and does not rewrite persisted relation endpoints.

The default analytical relation vocabulary remains the existing dialectical set:

- `supports`
- `disputes`
- `interprets-as`

A query may explicitly opt into other core or extension relation kinds.

## Counterfactual rule

A counterfactual query may suppress node or relation identities in a derived graph.

It returns:

- baseline reachable identities and frontier;
- resulting reachable identities and frontier;
- disconnected identities;
- frontier additions and removals.

Suppression never mutates, deletes, rewrites, or downgrades the source Horn document.

## Dominator rule

A node dominates a target when every reader-facing dialogue path from the selected focus to that target passes through the node.

This is a structural property of the selected graph and relation vocabulary. It does not mean the dominating claim is philosophically necessary, evidentially sufficient, or true.

## Minimum-cut rule

`min-cut` computes one deterministic minimum internal vertex cut between focus and target using unit-capacity node splitting and max flow.

The focus and target are never eligible cut nodes.

If a direct or otherwise internally uncuttable path exists, the result reports `finite: false` rather than pretending an internal cut exists.

A minimum cut is a debugging/impact primitive. It is not a recommendation to remove claims from the authored map.

## Native rule

`horn::IQueryService` remains serialized-artifact based:

```text
canonical Horn document JSON
            +
 horn-query-request/0.1
            |
            v
      IQueryService
            |
            v
 horn-query-result/0.1
```

Native implementation sequence:

1. establish reference fixtures and expected query results;
2. port graph construction and stable ordering exactly;
3. port counterfactual and dominator behavior;
4. port minimum-cut behavior;
5. compare normalized outputs byte-for-byte;
6. register the provider in Celix only after equivalence is demonstrated.

## Consequences

- Horn gains an argument debugger without turning derived analysis into authored state.
- ECharts and Zeppelin can consume deterministic results rather than reimplement graph semantics.
- Future evidence impact and proof objects have a stable query substrate.
- C++ can optimize the same behavior later without becoming an independent semantic authority.
- More sophisticated algorithms may be added behind new operations/contracts without changing historical Horn source authority.
