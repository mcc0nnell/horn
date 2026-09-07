# Can Computers Think? (1998) — reconstruction constraints

This note records source-backed constraints for reconstructing Robert E. Horn's *Mapping Great Debates: Can Computers Think?* series. It is an analytical guide to the repository implementation, not a republication of the maps or handbook.

## Source set

Primary reconstruction sources currently available to the project:

- *Can Computers Think? — Map 1 of 7: The History and Status of the Debate* (1998).
- *Can Computers Think? Handbook* (MacroVU Press, 1998).
- *Worldviews in Turing Debate* / worldview-summary sheet derived from the seven-map series.

The original works remain copyrighted. Repository artifacts should encode structure, provenance, identifiers, and source-faithful summaries without reproducing the copyrighted works wholesale.

## Structural hierarchy

The handbook supports this hierarchy:

`series -> map -> issue area -> focus box -> dialogue thread -> argument`

An issue area is scoped by its focus box. Dialogue grows outward from that focus through support and dispute responses. Thread depth is therefore meaningful reader context, while the breadth of a branch or fan reflects the range of response around an issue.

The generic `regions` representation in `horn-document/0.1` is not yet sufficient to promote this hierarchy into persisted core schema. Until a versioned schema change is justified, issue/thread/frontier structure should be derived or carried under explicit extensions.

## Relation semantics

The Map 1 legend identifies three especially important relation families:

- `supports`
- `disputes`
- `interprets-as`

Support and dispute are broad argumentative families rather than strict formal-logic predicates. They cover multiple affirmative and negative forms of response.

The handbook distinguishes semantic response direction from visual reading direction. In the current kernel:

`response --semantic relation--> earlier claim`

Reader-facing dialogue is derived in the opposite direction:

`earlier claim -> response -> counterresponse`

See ADR 0007.

## Focus boxes

A focus box introduces and summarizes the central dispute of an issue area. It may be an unattributed general position or assumption rather than a conventional authored claim.

`focus: true` is therefore stronger than generic visual emphasis and should only be used where source evidence supports focus-box status.

## Frontiers and unmapped territory

A terminal box in a mapped dialogue thread represents the current mapped frontier for that thread. Frontier status is contextual and derivable.

`unmapped-territory` is different. It marks relevant neighboring or boundary territory that the cartographers deliberately did not map fully. It should not be collapsed into a terminal claim or treated as merely missing data.

The handbook separately lists several unmapped subject territories across Maps 2, 3, 5, and 6. These are useful reconstruction targets but should remain explicitly marked as outside the mapped core unless source material supplies their argument structure.

## Cross-links and cartographic simplification

The historical debate contains cross-links that the printed maps intentionally suppress to avoid visually confusing convergence. Printed threads largely branch outward rather than converge.

Therefore:

- the historical mural must preserve Horn's authored cartography;
- an analytical graph may expose additional verified cross-links;
- analytical cross-links must not be written back as invented historical routes;
- notes associated with argument boxes are a likely source for reconstructing suppressed cross-links.

## Worldviews and postulates

The worldview/postulate sidebars exist because protagonists do not begin from identical philosophical assumptions and those assumptions are not always visible in the argument/rebuttal chains.

A safe semantic model is:

`protagonist -> associated-with -> worldview`

`worldview -> characterized-by -> postulate`

Association with a worldview must not imply that a protagonist accepts every postulate in that worldview. Any stronger belief relation requires direct source evidence.

The available worldview source identifies postulate families including physical symbol systems, Dreideggereanism, experiential realism, subsumption architecture, dialectical reasoning, ordinary language, functionalism, dynamical cognition, quasi-pictorial image psychology, Gestalt psychology, image psychology, and the subsymbolic paradigm, among others.

## Provenance and inclusion

The handbook describes an editorial policy that favors published arguments, historically early or well-known versions, non-duplicative claims, and selected empirical or implemented examples. Claims are represented as published at the time rather than silently rewritten to match an author's later position.

This supports keeping at least the following analytical distinctions available in provenance data:

- published argument
- historical precursor
- later published revision
- implemented model
- empirical result
- cartographic summary
- secondary articulation

These are not all promoted to core node kinds yet. Source-faithful reconstruction should prefer extensions until the corpus demonstrates stable recurring semantics.

## Visualization boundary

The historical SVG mural answers: **how was this argument cartographically authored?**

ECharts projections answer analytical questions such as:

- What supports or disputes this claim semantically?
- How does the dialogue unfold from the focus box?
- Where are the current mapped frontiers?
- Which sources support a claim?
- Which philosophical worldviews frame a region of debate?
- Which verified cross-links were suppressed by the historical cartography?

No analytical layout is authoritative Horn geometry.
