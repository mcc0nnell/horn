# ADR 0007: Semantic relation direction and reading order are distinct

## Status

Accepted.

## Context

The 1998 *Can Computers Think?* handbook explains that the arrows on the printed argumentation maps primarily direct the reader through the dialogue. The maps are intended to be read from an earlier claim toward later supports, disputes, and counterresponses.

That reader-facing direction is not the same thing as the ordinary semantic direction of a support or dispute statement. Semantically, a later response supports or disputes an earlier claim. In reader order, the earlier claim leads to the later response.

The handbook also explains that issue areas grow from focus boxes into branching dialogue threads and that the terminal argument in a thread represents the current frontier of that mapped debate. The printed cartography deliberately suppresses much cross-link convergence to preserve readability.

Primary methodological source: Robert E. Horn, *Mapping Great Debates: Can Computers Think? Handbook* (MacroVU Press, 1998), especially the FAQ discussion of map reading, linearity, arrows, and terminal boxes (handbook pp. 7–8 in the printed pagination).

## Decision

`HornRelation.from -> HornRelation.to` remains the **semantic response direction** in the document kernel:

- `from` is the responding claim;
- `to` is the claim being supported, disputed, interpreted, or otherwise addressed.

Reader-facing thread structure is **derived**, not persisted by reversing those semantic response edges from a focus box outward:

`earlier claim -> later response -> later counterresponse`

`src/structure.ts` owns this analytical derivation.

Persisted `route` geometry remains authored cartographic data. A future historical arrowhead renderer must not infer arrowhead direction merely from `from` and `to`; it must use source-faithful cartographic evidence or explicit reading-direction metadata when such metadata is added to the document format.

## Frontier

For a derived dialogue thread, a frontier node is a reachable terminal response: a node for which the mapped dialectical thread contains no later response. Frontier is therefore analytical state derived from a specific focus and relation vocabulary. It is not currently promoted to a persisted core field in `horn-document/0.1`.

## Invariants

- Semantic response direction and reading direction must never be silently conflated.
- Analytical derivation must not rewrite `HornRelation.from`, `HornRelation.to`, or authored route geometry.
- The default dialogue vocabulary is deliberately narrow: `supports`, `disputes`, and `interprets-as`.
- Other relation kinds enter a derived thread only when a caller explicitly opts them in.
- Frontier status is contextual to a focus/thread, not an intrinsic property of a claim.
- The historical mural remains authoritative for cartographic placement and route geometry.

## Consequences

The Argument projection can expose semantic support/dispute topology while the Frontier projection exposes Horn's reader-facing dialogue progression. Both can be generated from one canonical document without pretending that the two directions mean the same thing.

This also leaves room for later reconstruction of suppressed cross-links from Horn's notes: those links may enrich the analytical debate graph without forcing the historical mural into a visually convergent graph layout that Horn explicitly avoided.
