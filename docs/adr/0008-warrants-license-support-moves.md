# ADR-0008: Warrants license support moves

Status: Accepted

## Context

`horn-argument/0.1` initially modeled a warrant as a free-standing `warrants` edge from a warrant claim to a position. That is convenient graph notation, but it loses the semantic distinction described in Robert E. Horn's *Introduction to Argumentation Mapping*.

Horn follows the Toulmin model: grounds are offered in support of a position; a warrant is the assertion that entitles the reader to make that move from those grounds to that position; backing provides a deeper basis for accepting the warrant.

A warrant therefore concerns an **inference**, not merely a destination claim.

## Decision

In the semantic argument layer:

- `supports` and `disputes` connect claims;
- a `supports` relation may name `warrantClaimId`;
- that referenced claim must have role `warrant`;
- `backs` connects a claim with role `backing` to a claim with role `warrant`;
- a warrant may not be attached to a non-support relation.

Example:

```json
{
  "claims": [
    { "id": "grounds-smoke", "role": "grounds", "statement": "I see smoke.", "sourceIds": ["source"] },
    { "id": "position-fire", "role": "position", "statement": "There is a fire.", "sourceIds": ["source"] },
    { "id": "warrant-smoke-fire", "role": "warrant", "statement": "Smoke means fire.", "sourceIds": ["source"] }
  ],
  "relations": [
    {
      "id": "smoke-supports-fire",
      "kind": "supports",
      "from": "grounds-smoke",
      "to": "position-fire",
      "warrantClaimId": "warrant-smoke-fire"
    }
  ]
}
```

The support relation is the move. The warrant licenses the move.

## Cartographic realization

`horn-document/0.1` is allowed to render the same semantics differently. A mural may draw:

- the support road from grounds to position; and
- a separate `warrants` road from the warrant box toward the supported position.

That cartographic road is a visual realization of the semantic support's `warrantClaimId`; it is not evidence that the semantic model contains an independent warrant edge.

`validateArgumentCartography` checks this correspondence.

## Consequences

The semantic IR can preserve the argument's inferential structure instead of flattening Horn's vocabulary into ordinary graph edges.

Backing can be represented without ambiguity, and future analysis can ask not only which claim supports another, but which warrant licenses that particular support.

This ADR is intentionally about semantics, not geometry. The route used to depict a warrant remains authored cartography.
