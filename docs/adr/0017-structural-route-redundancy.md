# ADR-0017: Structural route redundancy is explicit analysis

Status: Proposed

## Context

The Map 1 reasoning cockpit can already inspect causal paths, simulate single-claim counterfactuals, and rank structural sensitivity. Those tools identify single points of failure, but they do not answer whether an argument has alternate semantic routes to the focus or whether two individually survivable claims form a joint cut set.

Calling multiple responders "redundant" from semantics alone would overstate what the graph proves. A support claim and another support claim may be different evidence, and support/dispute labels do not establish interchangeability, confidence, or evidentiary weight.

## Decision

Horn may analyze **route redundancy** as graph reachability while keeping semantic/evidentiary redundancy out of scope.

The first redundancy analysis is limited to intermediary node cuts between visible claims and the argument focus:

- a single-claim intermediary cut exists for a target when removing some other non-focus claim destroys the target's previously visible route to the focus;
- a minimal two-claim cut exists for a target when removing either cut member alone preserves the target's route, but removing both destroys it;
- cut members and the argument focus are never counted as disconnected targets;
- pair-cut analysis is constrained to the active visibility lens or issue stream;
- claims with no intermediary cut of size one or two are reported only as "no intermediary cut up to size 2" rather than being assigned a stronger connectivity claim.

The analyzer also fingerprints a visible graph as a **rooted arborescence** when every visible claim reaches the focus, the focus has no outgoing move, and every other visible claim has exactly one outgoing semantic move. In that topology every non-focus claim has one route toward the focus, so pair-only route failures cannot exist.

## Map 1 result

The current full Map 1 semantic projection is a rooted arborescence:

- 131 claims;
- 130 semantic relations;
- 11 claims connect directly to the focus;
- 119 non-focus claims have at least one single-claim intermediary cut;
- zero claims require a minimal two-claim intermediary cut;
- zero minimal pair-only cut sets exist;
- 11 claims have no intermediary cut up to size 2 because they connect directly to the focus.

Each of the 11 issue-stream projections has the same rooted-arborescence fingerprint.

This is a topology result, not a judgment that Map 1 lacks argumentative diversity. Multiple claims may still bear on the same target. The result says only that the current semantic extraction gives each non-focus claim one path toward box 1.

## Performance boundary

Pair-cut sweeps use reverse reachability from the focus. For each hypothetical removal set, Horn computes the claims that can still reach the focus with one traversal of the visible graph. This keeps the size-two sweep appropriate for the current cockpit scale without multiplying a full traversal by every target claim.

Higher-order cut sets are not admitted by this ADR. They should use a more deliberate connectivity algorithm and an explicit complexity budget before becoming interactive cockpit behavior.

## Consequences

Horn can distinguish single-route trees from graphs with genuine alternate semantic routes and can expose minimal two-claim route cuts without inventing belief semantics. The cockpit may display these results as structural diagnostics, but must not label cut members as equivalent evidence, interchangeable reasons, or probability-bearing redundancy.
