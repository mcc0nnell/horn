# ADR-0009: Extraction decisions are first-class artifacts

Status: Proposed

## Context

`horn-argument/0.1` makes argument semantics explicit, but a normalized claim is already the result of editorial work.

Robert E. Horn's *Introduction to Argumentation Mapping* describes that work as a sequence: choose sources, identify all relevant claims, separate multiple claims that may be buried in one sentence or paragraph, select which claims belong on the map, and then rewrite claims for clarity and consistency before structuring the argument.

If Horn stores only the normalized argument, the most consequential human judgments disappear:

- what source passage was inspected;
- what candidate claims were seen in that passage;
- which candidates were selected or rejected;
- whether several candidates were merged;
- how a selected candidate was normalized into its semantic claim.

Those decisions should be reviewable without turning the source corpus itself into Horn's ontology.

## Decision

Horn adds `horn-extraction/0.1`, an auditable intermediate artifact between source corpus and semantic argument.

```text
source corpus
     |
     v
source spans
     |
     v
candidate claims
     |
     v
selection decisions
 select / reject / merge
     |
     v
normalized claim outputs
     |
     v
horn-argument/0.1
```

An extraction record contains:

- references to declared argument sources;
- stable source spans with locators and captured text;
- candidate claims tied to one or more spans;
- one explicit decision for each candidate;
- reasons for selection, rejection, or merge;
- the semantic claim identity and normalized statement produced by selected/merged candidates.

## What the validator proves

The extraction validator proves structural auditability, not editorial correctness.

It rejects:

- source spans whose source is not declared by the extraction;
- extraction sources absent from the target argument;
- candidates that cite nonexistent spans;
- candidates with no decision;
- decisions for nonexistent candidates;
- merge decisions that reference nonexistent candidates;
- selected/merged decisions that do not resolve to a target semantic claim;
- normalized outputs that differ from the statement stored in the target `horn-argument/0.1` claim.

It does **not** decide whether the cartographer identified the best candidate claim, made the right selection decision, or normalized prose well. Those are reviewable judgments, not mechanical invariants.

## Provenance boundary

A source span is evidence, not a claim ontology. Horn records the minimum material required to audit the transformation while retaining a stable locator back to the source.

Historical extraction records must not fabricate or paraphrase source spans and label them as source text. If the actual source text or stable locator is unavailable, the extraction record is incomplete and should remain absent rather than silently reconstructed.

## Relationship to argument and cartography

```text
horn-extraction/0.1
        |
        v
horn-argument/0.1
        |
        v
authored cartography
        |
        v
horn-document/0.1
```

Identity crosses the first seam through `claimId`: a selected or merged candidate states exactly which semantic claim it produced.

Identity crosses the second seam through the claim/node identifiers defined by ADR-0007 and validated by `src/correspondence.ts`.

Thus one mapped claim can be traced backward from mural geometry to argument semantics to the editorial decision and source span that produced it.

## Consequences

Horn's compiler metaphor becomes concrete without claiming automatic authorship.

The system can support human, assisted, or automated candidate extraction later, but all three must emit the same reviewable extraction artifact. An AI model may propose candidates; it does not acquire authority merely by proposing them.

The first historical extraction specimen should be created only when the actual source corpus and stable source locators are available.
