# ADR-0007 — Celix handbook rules runtime

Status: accepted  
Date: 2026-09-07

## Context

Horn already has a canonical document kernel (`horn-document/0.1`), a validator, a pure SVG mural renderer, a viewBox camera, Zeppelin runtime integration, and an ECharts analytical-projection branch. Those layers have explicit authority boundaries that must remain intact.

Robert E. Horn's 1998 *Can Computers Think?* handbook and maps describe cartographic conventions for issue areas, focus boxes, support/dispute threads, reading direction, unmapped territory, landmarks, postulates, sidebars, and related mural objects. Horn's 2003 *Introduction to Argumentation Mapping* describes a later authoring methodology for choosing sources, identifying and selecting claims, structuring a first draft, writing claims, and naming claims.

These are related but not identical methodological contracts. They should not be collapsed into a single timeless rule set, and they should not be encoded by weakening `horn-document/0.1` into a generic graph or policy format.

## Decision

Add an optional Apache Celix runtime under `runtime/celix/` that evaluates versioned Horn methodology profiles against existing `.horn.json` documents.

The Celix runtime is **analysis-only**:

- `.horn.json` remains canonical authority.
- Rules may emit diagnostics, evidence, and suggestions.
- Rules may not mutate documents, synthesize geometry, rewrite relation routes, or serialize derived state back into `.horn.json`.
- The existing TypeScript validator remains the document-contract validator.
- The SVG renderer remains the mural renderer.
- ECharts remains a disposable analytical projection.
- Zeppelin remains a runtime envelope around canonical Horn documents.

Celix provides dynamic discovery and composition of methodology rules; it does not replace the Horn document kernel.

## Methodology profiles

Profiles are versioned by source context.

Initial namespaces:

- `horn.rules.1998.*` — cartographic and *Can Computers Think?* conventions.
- `horn.rules.2003.*` — authoring and argumentation-mapping methodology.

A rule's provenance metadata must identify the source edition and the relevant chapter, section, map convention, or other source location at a useful human-readable level. Public code must implement distilled behavior rather than reproducing protected source text or images.

## First vertical slice

The first slice proves dynamic Celix service discovery and deterministic diagnostics without changing the document schema.

Initial rule candidates:

- `horn.rules.1998.focus-box`
- `horn.rules.1998.argument-reading-direction`
- `horn.rules.2003.claim-atomicity`
- `horn.rules.2003.focus-claim-formulation`

The implementation may begin with a smaller subset if that keeps the service contract minimal and testable.

## Rule contract

Rules consume a read-only adapter over the existing Horn document. The adapter exposes only the data needed for analysis and must preserve identifiers exactly as authored.

Each diagnostic carries at least:

- stable `ruleId`
- severity
- target document/node/relation identity when applicable
- concise message
- optional suggestion
- methodology provenance metadata

Diagnostics are deterministic and sorted before CLI emission.

## Non-goals

The first Celix slice does not:

- add new core node or relation kinds
- change `horn-document/0.1`
- add a second canonical validator
- infer or repair historical geometry
- reproduce Horn's copyrighted maps or handbook text
- ingest PDFs into the public repository
- implement a general-purpose argument graph engine
- duplicate the ECharts or Zeppelin integration layers

## Consequences

Horn gains an executable methodology layer without compromising document authority.

Different historical or authoring profiles can coexist and evolve independently. Experimental rules can be added as Celix services, compared against the corpus, and removed or promoted without bloating the Horn document kernel.

This also makes disagreement explicit: a document can be valid Horn while still receiving methodology diagnostics under a selected profile.