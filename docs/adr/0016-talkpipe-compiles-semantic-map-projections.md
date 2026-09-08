# ADR-0016: TalkPipe compiles semantic map projections

Status: Proposed

## Context

ADR-0012 established `horn-argument/0.1` as the geometry-free semantic layer before Horn cartography and explicitly left open analytical projections that consume semantic arguments directly. Map 1 of *Can Computers Think?* now has a machine-readable corpus graph with stable claim identities and typed support/dispute relations, but the complete authored road geometry and mapped-source bibliography are not yet reconstructed as a historical `horn-document/0.1`.

Forcing that corpus graph through `horn-document/0.1` would either invent relation routes or mislabel source measurements as authored geometry. Neither is acceptable.

TalkPipe already supplies a composable ChatterLang authoring/processing boundary. ECharts already supplies disposable analytical views.

## Decision

TalkPipe is the compile boundary from corpus-shaped source material to a semantic `horn-argument/0.1` artifact.

For analytical views that do not require authored Horn cartography, ECharts may project directly from `horn-argument/0.1`.

A projection may also consume a sibling `sourceLayout` envelope containing measured source coordinates. That envelope is explicitly non-canonical:

- it is not part of `horn-argument/0.1`;
- it is not `horn-document/0.1` geometry;
- it is not persisted back from ECharts;
- it must identify its authority as analytical-hint-only;
- it must not contain reconstructed Horn relation routes unless those routes have been separately authored and admitted into a HornDocument.

The first pipeline is:

```text
global argument corpus
        |
        v
     TalkPipe
  hornCorpus source
        |
        v
 hornMapArgument
        |
        +----> horn-argument/0.1
        |
        +----> sourceLayout (measurement hints only)
                    |
                    v
                  ECharts
             Map 1 analytical view
```

## Map 1 first slice

The Map 1 corpus is compiled as a rooted semantic argument:

- box 1 is the focus position;
- a claim whose outgoing relation is `supports` is represented as grounds in this extraction projection;
- a claim whose outgoing relation is `disputes` is represented as rebuttal;
- support/dispute edge direction remains semantic: responder → claim being supported/disputed;
- measured source boxes may place ECharts nodes near their historical source positions, while ECharts edges remain analytical straight edges.

This role derivation is an extraction rule for the current Map 1 corpus shape, not a universal rule for Horn arguments.

## Analytical issue navigation

Compiled argument streams are also the navigation units for the ECharts cockpit. A stream may carry a `sourceRegionId` that identifies the measured source region from which the stream was derived, but that identity does not promote the region measurement into Horn cartography.

Selecting a stream is a projection-only operation:

- the underlying `horn-argument/0.1` and `sourceLayout` remain unchanged;
- the stream focus claim remains visible;
- only claims named by the stream are projected;
- a semantic relation is projected only when both endpoints remain visible;
- an unknown stream identifier fails closed rather than silently falling back to the full map;
- when measured positions are complete, ECharts preserves their aspect ratio rather than stretching the source geometry to the viewport.

This gives the analytical renderer issue-by-issue navigation while keeping the same semantic identities and source measurements available to every other renderer.

## Semantic cockpit inspection

The Map 1 cockpit may expose a selected claim through a semantic inspector. The inspector is a read-only projection over the argument artifact and may show only facts already present in that artifact, including claim role, source locator, attribution, provenance/origin, stream membership, and direct support/dispute neighborhood.

Inspector navigation is projection-only:

- selecting a claim does not mutate Horn argument state;
- selecting an issue stream resets the visible claim selection to that stream's focus claim;
- neighborhood traversal may select only claims visible in the active stream;
- unknown claims and claims outside the active stream fail closed;
- the inspector must not label semantic inspection as runtime trace evidence until a real runtime trace source exists.

This is the first vivisection surface, but it is semantic vivisection rather than execution-trace vivisection.

## Measured issue-region overlay

The cockpit may also draw issue-region rectangles from `sourceLayout.regions` as a disposable interaction layer over the ECharts map.

Region interaction follows the same authority boundary:

- a rectangle is a measured source-region hint, not authored Horn cartography;
- region bounds are transformed through the active ECharts graph coordinate system and recomputed after graph roam or resize;
- hovering a region may preview the claims in the stream or streams associated with that region;
- clicking a region may select an issue stream only when that region resolves to exactly one stream;
- ambiguous or unmapped regions remain visible but are not allowed to silently choose a semantic stream;
- selecting or clearing a region never mutates `horn-argument/0.1` or `sourceLayout`.

The overlay exists to make the original Map 1 geography perceptible while retaining the distinction between measured source layout and reconstructed authored geometry.

## Causal reasoning lens

The cockpit may compute a causal lens directly from visible semantic relations without rewriting the argument artifact.

For Map 1, semantic relation direction is responder → claim being supported or disputed. The analytical lens therefore treats:

- recursive incoming relations as claims that bear on the selected claim;
- recursive outgoing relations as the semantic context the selected claim bears on;
- the shortest visible outgoing path from the selected claim to the argument focus as the `whyPath` shown by the inspector.

Causal traversal remains projection-only:

- unrelated claims are downplayed in ECharts rather than removed from Horn state;
- traversal is constrained to the active issue stream when one is selected;
- the focus claim must remain inside the active causal lens;
- a selected claim outside the active stream fails closed;
- cycles are tolerated by visited-set traversal rather than recursion without bounds;
- a missing visible path to the focus is reported as disconnected rather than guessed;
- the `whyPath` is semantic explanation, not execution-trace evidence.

This gives Map 1 a reasoning-debugger interaction while preserving the distinction between semantic causality, measured source layout, authored cartography, and future runtime vivisection.

## Counterfactual vivisection

The cockpit may apply a reversible hypothetical transformation to a visible non-focus claim without changing the canonical argument artifact.

The first two counterfactuals are deliberately structural:

- `remove` excludes the selected claim and its incident relations in a temporary projection and reports claims that previously reached the focus but become disconnected;
- `invert` flips exactly one visible `supports`/`disputes` move and reports the selected claim plus its responder subtree as having a changed semantic orientation toward the focus.

Counterfactual analysis has strict limits:

- the focus claim cannot be removed or inverted;
- inversion requires exactly one visible outgoing semantic move and supports only `supports` ↔ `disputes`;
- active issue-stream visibility constrains the hypothetical graph;
- canonical `horn-argument/0.1` data and `sourceLayout` are never mutated;
- navigation clears the active hypothesis so hypothetical state cannot leak between claims or streams;
- affected claims may be emphasized or downplayed in ECharts, but the renderer must identify the result as hypothetical;
- a counterfactual must not claim that a proposition becomes true, false, more probable, or less probable until Horn has an explicit admitted belief/weight calculus;
- counterfactual output is semantic structural analysis, not execution-trace evidence.

This allows Horn to answer structural questions such as “which claims lose their route to the focus if this claim disappears?” and “which responder subtree inherits a changed orientation if this move is inverted?” without inventing an evaluation semantics.

## Structural sensitivity analysis

The cockpit may sweep the admissible single-claim counterfactuals across a visible map or issue stream to identify structural leverage and fragility.

The first sensitivity metrics are raw topology counts:

- `removalCascadeCount` is the number of *other* visible claims that previously reached the focus but lose that route when the selected claim is removed;
- `inversionCascadeCount` is the number of responder claims, excluding the selected claim itself, whose orientation toward the focus inherits the selected move's hypothetical support/dispute inversion;
- `articulationToFocus` is true when `removalCascadeCount > 0`;
- `structuralLeverage` is `max(removalCascadeCount, inversionCascadeCount)` and exists only as a deterministic sorting key over these two structural cascades.

Map-wide and stream-level sensitivity remain projection-only:

- the focus claim is never scored as a removable/invertible candidate;
- active issue-stream visibility constrains every sweep;
- streams that do not contain the argument focus are marked unanalyzable rather than reinterpreted around a different root;
- removal and inversion rankings preserve their raw counts rather than collapsing them into a hidden weighted score;
- issue-stream fragility ranking is lexicographic: maximum removal cascade first, then articulation count, then maximum inversion cascade;
- no sensitivity metric represents truth, probability, confidence, evidence weight, importance, or correctness;
- canonical `horn-argument/0.1` data and `sourceLayout` remain unchanged.

This turns counterfactual vivisection into a repeatable structural stress test: Horn can identify articulation claims, large responder cascades, and fragile issue streams while keeping evaluation semantics separate from topology.

## Consequences

Map 1 can become interactive before complete historical cartography has been reconstructed, without weakening the document invariants that protect Horn's authored visual language. TalkPipe owns the reproducible compile step; Horn owns semantic identity; ECharts owns disposable interaction.
