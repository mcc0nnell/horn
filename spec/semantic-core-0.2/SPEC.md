# HORN 0.2 — Semantic Core Specification

Status: Draft  
Version: 0.2  
Scope: Source-grounded argument representation, independent of rendering geometry.

## 1. Purpose

HORN represents arguments recovered from source material. It does not encode document layout and it does not define a poster format.

A HORN implementation separates four layers:

1. **Source** — documents and passages as encountered.
2. **Semantic model** — normalized issues, claims, relations, and context.
3. **Argument map** — a scoped debate with one issue, one focus claim, and one or more streams.
4. **Rendering** — poster, outline, tree, graph, web, or other projections.

The semantic model MUST NOT depend on poster coordinates, colors, fonts, or page geometry.

### Normative-origin labels

Normative rules in this specification are annotated with one of:

- **HORN-DERIVED** — directly supported by Horn's handbook terminology or instructions.
- **HORN-INTERPRETATION** — a conservative formalization of Horn's method.
- **ENGINEERING** — an implementation rule introduced by this specification.

These labels document provenance; they do not change RFC-style requirement strength.

## 2. Core concepts

### 2.1 Source

A `source` identifies an external work used to reconstruct a debate.

A source MAY include bibliographic metadata such as title, author, year, URI, publisher, or note.

**Origin:** HORN-DERIVED for source selection as part of mapping; ENGINEERING for machine identifiers and metadata fields.

### 2.2 Passage

A `passage` identifies a bounded portion of a source.

A passage MUST reference exactly one source.

A passage MUST preserve source wording separately from normalized claim wording.

**Origin:** HORN-INTERPRETATION. Horn explicitly extracts multiple claims from a single source passage, so source wording and claim wording cannot be the same object.

### 2.3 Issue

An `issue` is the question under debate.

Each issue MUST have exactly one `type` and one `question`.

The 0.2 issue types are:

- `fact`
- `action`
- `terminology`
- `ethics`
- `law`
- `goal`
- `means`
- `explanation`

**Origin:** HORN-DERIVED.

An issue question SHOULD be scoped narrowly enough that the focus claim can answer it clearly.

**Origin:** HORN-DERIVED.

### 2.4 Claim

A `claim` is one independently comprehensible argumentative proposition.

A claim MUST have a stable identifier and `text`.

A claim's identifier MUST NOT be derived from its exact wording.

**Origin:** HORN-DERIVED for one-claim-per-box and iterative rewriting; ENGINEERING for stable identifier semantics.

A claim MAY contain more than one sentence if needed for clarity. Sentence count does not define claim atomicity.

**Origin:** HORN-DERIVED.

A claim MAY carry:

- `role`
- `derivation`
- `editorial_state`
- `evidence_state`
- one or more `evidence` references
- an optional classical or topic `alias`
- optional notes

### 2.5 Claim roles

The optional `role` vocabulary is:

- `position`
- `ground`
- `warrant`
- `backing`
- `rebuttal`

**Origin:** HORN-DERIVED.

Roles are annotations on claims. They are NOT additional relation types in HORN 0.2.

**Origin:** HORN-INTERPRETATION.

### 2.6 Relations

HORN 0.2 defines exactly two normative argumentative relation kinds:

- `supports`
- `disputes`

A relation MUST connect two existing claims.

**Origin:** HORN-DERIVED for relation kinds; ENGINEERING for referential integrity.

HORN 0.2 intentionally does not define `warrants`, `backs`, `qualifies`, or `excepts` as graph edge kinds.

### 2.7 Argument stream

A `stream` is a semantic grouping of claims and relations that form one coherent argumentative line within a debate.

Stream membership MUST NOT be inferred from source-document adjacency alone.

**Origin:** HORN-DERIVED.

A claim MAY appear in more than one stream.

**Origin:** ENGINEERING.

### 2.8 Debate

A `debate` is the unit represented by one argument map.

A debate MUST contain:

- exactly one `issue`
- exactly one `focus`
- one or more claims
- zero or more relations
- zero or more streams
- zero or more context items
- zero or more subdebates

**Origin:** HORN-INTERPRETATION.

### 2.9 Focus claim

The `focus` is the claim that answers the debate's issue.

The focus MUST reference a claim contained in the debate.

The focus SHOULD be positively formulated when doing so improves clarity.

The focus MAY be inferred or synthesized rather than directly quoted from a source, but that derivation SHOULD be explicit.

**Origin:** HORN-DERIVED for Focus Box Claim and positive formulation; ENGINEERING for explicit derivation metadata.

### 2.10 Context

`context` contains material useful to a map that is not itself part of the support/dispute graph.

Initial context kinds are:

- `definition`
- `history`
- `presupposition`
- `proposal`
- `editorial_note`

A context item MUST NOT be the endpoint of a `supports` or `disputes` relation.

**Origin:** HORN-DERIVED for sidebars, definitions, presuppositions, and proposal material; ENGINEERING for typed context and graph separation.

### 2.11 Space and arena

A `space` groups multiple debates into a navigable debate space.

A space MAY include named `arena` groups.

An arena contains debate references or nested debate definitions.

**Origin:** HORN-DERIVED from Horn's top-level entry into a group of debates.

### 2.12 Subdebate

A `subdebate` is a debate nested under another debate.

A subdebate MUST have its own issue and focus.

A stream is not a subdebate.

**Origin:** HORN-DEIEVED for submaps; ENGINEERING for explicit distinction.

## 3. Provenance and derivation

A claim MAY have one of these derivations:

- `extracted` — close proposition-level extraction from one source passage.
- `summarized` — concise restatement of source rhetoric.
- `synthesized` — combines compatible evidence from more than one passage.
- `inferred` — implicit proposition necessary to represent the debate.

These labels are HORN 0.2 engineering metadata.

An `inferred` claim with no evidence SHOULD produce a warning.

A claim may cite multiple passages.

## 4. Editorial and evidence state

HORN separates editorial readiness from evidentiary grounding.

### 4.1 Editorial state

- `draft`
- `review`
- `publishable`

### 4.2 Evidence state

- `missing`
- `partial`
- `grounded`
- `verify`

These states do not assert whether a proposition is true.

A claim may be strongly grounded as a faithful representation of what a source argues while remaining disputed in the argument graph.

## 5. Normative invariants

### I001 — One issue per debate
A debate MUST contain exactly one issue.  
**Origin:** HORN-INTERPRETATION.

### I002 — One focus per debate
A debate MUST contain exactly one focus claim.  
**Origin:** HORN-INTERPRETATION.

### I003 — Focus answers issue
The focus claim MUST be intended as an answer to the debate issue.  
**Origin:** HORN-DERIVED.

### I004 — One proposition per claim
A claim MUST represent one argumentative proposition.  
**Origin:** HORN-DERIVED.

### I005 — Existing relation endpoints
Every relation endpoint MUST identify a claim in the same debate.  
**Origin:** ENGINEERING.

### I006 — Relation vocabulary
Every relation kind MUST be `supports` or `disputes`.  
**Origin:** HORN-DERIVED.

### I007 — Source order is non-normative
Source-document ordering MUST NOT determine map ordering.  
**Origin:** HORN-DERIVED.

### I008 — Context is non-argumentative
Context MUST NOT participate directly in `supports` or `disputes` relations.  
**Origin:** HORN-INTERPRETATION.

### I009 — Definitions are contextual unless disputed
A definition included only to explain terminology SHOULD be context rather than a claim.  
**Origin:** HORN-DERIVED.

### I010 — Stable claim identity
Claim identity MUST survive wording revisions.  
**Origin:** ENGINEERING, motivated by HORN-DERIVED iterative rewriting.

### I011 — Subdebate completeness
A subdebate MUST independently satisfy I001 and I002.  
**Origin:** ENGINEERING, motivated by HORN-DERIVED submaps.

### I012 — Stream ownership
Every stream MUST belong to exactly one debate.  
**Origin:** ENGINEERING.

## 6. Editorial lint

Editorial lint does not make a HORN document structurally invalid.

Recommended warning codes:

- `H001 MULTIPLE_CLAIMS` — text may contain more than one proposition.
- `H002 UNBOUNDED_ISSUE` — issue looks like a topic rather than a question.
- `H003 ORPHAN_CLAIM` — claim participates in no relation or stream.
- `H004 MISSING_FOCUS` — structural error, not merely editorial.
- `H005 DUPLICATE_CLAIM` — two claims appear semantically duplicative.
- `H006 VAGUE_PRONOUN` — claim depends on an unresolved pronoun.
- `H007 ATTRIBUTION_IN_CLAIM` — unnecessary "X says..." wording.
- `H008 DEFINITION_AS_CLAIM` — explanatory definition appears in the argument graph.
- `H009 NEGATIVE_FORM` — positive wording may be clearer.
- `H010 SOURCELESS_CLAIM` — publishable claim lacks provenance.
- `H011 UNSUPPORTED_WARRANT` — challenged warrant lacks represented backing.
- `H012 RESEARCH_DEBT` — unresolved source or verification work exists.
- `H013 HIDDEN_RELATION` — wording such as "because" or "therefore" may hide another claim.
- `H014 DUPLICATE_TERMINOLOGY` — unnecessary synonym proliferation.
- `H015 OUT_OF_SCOPE` — claim may not belong to the issue.

## 7. Rendering

Renderers consume the semantic model.

A renderer MUST NOT change claim identity, issue identity, relation kinds, or evidentiary provenance.

A renderer MAY:

- order supports before disputes;
- show aliases or claim text as titles;
- collapse or expand context;
- group streams visually;
- provide continuation/navigation devices;
- render the same model as poster, outline, tree, graph, or web.

"Supports before Disputes" is a presentation rule, not graph semantics.

## 8. Title-is-the-Claim profile

The default HORN 0.2 display profile is `title_is_claim`.

Under this profile, the visible node heading is the concise proposition itself.

A classical or topic title MAY be preserved as `alias`.

This profile is preferred because it keeps claim nodes semantically self-contained and supports alternate outline/tree projections.

## 9. Non-goals for 0.2

HORN 0.2 does not standardize:

- page geometry
- poster colors or typography
- automatic graph layout
- truth values
- confidence scores
- formal proof semantics
- a complete Toulmin calculus
- source retrieval protocols
- AI extraction behavior
- cross-debate inference

These may be added in later versions.

## 10. Canonical interchange

The canonical interchange form for 0.2 is JSON conforming to `schema/horn.schema.json`.

The human-authored DSL in `grammar/horn.ebnf` compiles to the canonical JSON form.

Renderers and validators SHOULD consume canonical IR rather than parse prose or source documents directly.

## 11. Conformance strategy

The initial golden fixture is a clean-room semantic encoding of the cloning terminology example from Horn's handbook.

It intentionally preserves:

- one terminology issue;
- one focus claim;
- support and dispute relations;
- source-grounding metadata;
- a Title-is-the-Claim display profile.

It does not reproduce Horn's copyrighted page layout.
