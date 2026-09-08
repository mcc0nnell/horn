# ADR-0016: libhorn deterministic analysis reactor

Status: Accepted

## Context

Phase 1 of libhorn proved golden validation equivalence between TypeScript
`validateHornDocument` and the native `IValidationService` provider. The native
runtime still lacked the rest of the headless analysis plane: renderer-neutral
projections, deterministic graph query, explanation, evidence impact, semantic
diff, and counterfactual analysis.

Those capabilities already exist as TypeScript reference behavior (analytical
views, thread derivation, node tracing, evidence fingerprinting) or follow
directly from existing Horn relation vocabulary. They must not become a second
ontology, a round-trip authoring path, or an AI/LLM kernel.

## Decision

libhorn grows a **deterministic analysis reactor**. It consumes canonical Horn
artifacts and emits derived, disposable analysis artifacts. It never becomes
the serialization authority for authored murals.

### Authority

- Canonical Horn artifacts remain authoritative (`horn-document/0.1`,
  `horn-argument/0.1`, `horn-extraction/0.1`, `horn-projection/0.1`).
- Analyses are derived and disposable. They may be regenerated at any time
  from the same inputs.
- Analytical projections cannot round-trip into authored geometry. Node
  centers, reading-order edges, and frontier lanes are derived facts, not
  mural roads.
- Counterfactuals cannot become authored state implicitly. Suppressing a
  node, relation, or evidence binding is an analysis request; the source
  artifact is left untouched.
- Native behavior advances to authority only through golden equivalence with
  the TypeScript reference.
- AI/LLM behavior is outside the deterministic libhorn kernel. The reactor
  returns structured facts and paths. Narration is a client concern.

### ABI

Service I/O remains serialized JSON. This pass does not freeze a native C++
domain ontology. New analysis artifact versions (`horn-query/0.1`,
`horn-query-result/0.1`, `horn-explanation/0.1`, `horn-impact-report/0.1`,
`horn-diff/0.1`, `horn-inspect/0.1`) are derived contracts. Source schemas are
not changed to simplify the C++ port.

`horn-projection/0.1` remains the renderer-neutral projection envelope. The
four analytical views (`argument`, `timeline`, `evidence`, `frontier`) are
emitted as projection manifests whose `target` is the view name. Derived
analytical facts that are not Horn identities live under
`extensions["x-analysis"]`. ECharts option objects are forbidden inside
libhorn.

### Services

Celix providers, each advertising explicit contract version properties:

- `horn::IValidationService` — unchanged Phase 1 report
- `horn::IProjectionService` — four analytical views
- `horn::IQueryService` — artifact-based JSON request → JSON result, including
  counterfactual analysis as a query operation
- `horn::IExplanationService` — structured explanation of one identity
- `horn::IImpactService` — evidence snapshot + bindings + document → impact
  report (consequences only; never rewrites claims)
- `horn::IDiffService` — before/after Horn artifacts → `horn-diff/0.1`

`horn_inspect` composes those services. It is not a new semantic authority.

### TypeScript remains the reference

Until a behavior has golden equivalence, TypeScript is the semantic reference.
New query, explanation, impact, and diff operations are implemented in
TypeScript first, then ported. Where the ECharts views mix presentation with
analysis, only the deterministic analytical facts are ported:

- identity selection and sort order
- relation selection without authored routes
- argument node centers (`geometry.x + w/2`, `geometry.y + h/2`) as justified
  by ADR-0006
- chronological order of dated nodes
- citation-to-claim evidence bindings
- `deriveHornThread` reading order, depth, lane, and frontier membership

ECharts presentation (animation, HTML tooltips, symbol sizes, force-layout
parameters, pixel coordinates of the form `depth/maxDepth * 1000`) is not
part of the projection contract. Evidence force layout is not deterministic
and is not a native obligation.

## Consequences

libhorn can answer analytical questions without owning cartography.
Zeppelin, ECharts, and future clients remain adapters. Golden harnesses and
the seeded torture generator run locally; GitHub Actions is not the runtime
contract.

## Ambiguities left unresolved

These were not invented as new Horn semantics; they are documented choices or
deferred work:

1. ECharts presentation (`animationDurationUpdate`, HTML tooltips, `symbolSize`,
   force-layout parameters, frontier pixel coordinates of the form
   `depth/maxDepth * 1000`) is not part of the projection contract. Argument
   node centers *are* included because ADR-0006 places the argument view at
   authored rectangle centers.
2. Evidence force layout is non-deterministic and is not a native obligation.
3. Orphan identity is defined as nodes with no incident relation and citations
   never referenced by any `citationIds`.
4. Transitive evidence impact walks every document relation in both directions
   from directly stale nodes. That is a conservative consequence report, not a
   new argumentative rule.
5. `addresses` is not a dialogue-thread edge unless a caller opts in, matching
   `deriveHornThread`.
6. Optional `horn-argument/0.1` and `horn-extraction/0.1` inputs enrich
   explanation when present and are omitted when absent.
7. Queries still run on structurally invalid documents; validation remains a
   separate report. Duplicate-id lookups follow JavaScript `Map` last-write-wins
   so native and TypeScript stay equivalent.
8. `resolveHornProjection` remains a TypeScript consumer-manifest resolver. The
   native `IProjectionService` generates analytical views; it does not resolve
   RUSTBELT-style selection manifests.

Remaining work before libhorn can become the preferred Horn headless runtime:

- Celix bundle/container tests in an environment that actually has Apache Celix;
- native golden coverage of extraction/correspondence validators;
- an explicit ABI freeze of native domain types, only after the semantic core
  is stable;
- a `%horn` Zeppelin adapter that discovers these services;
- performance benchmarks, which must not become CI gates yet;
- any LLM/narration layer, which remains outside the deterministic kernel.
