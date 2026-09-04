# ADR-0007: Horn has a semantic argument layer before cartography

Status: Accepted

## Context

Robert E. Horn's *Introduction to Argumentation Mapping* describes argumentation mapping as a method, not merely as a finished visual artifact. The handbook proceeds from components of arguments, through choosing sources, identifying and selecting claims, structuring a first draft, writing claims, naming claims, and top-level entry into debates.

The method distinguishes positions, grounds (data), warrants, backing, and rebuttals. It also treats issue questions, focus claims, argument streams, subarguments, source selection, claim normalization, and support/dispute structure as meaningful before final map geometry is authored.

The existing `horn-document/0.1` format begins later in that process. It is a cartographic document: every node has geometry, relations may have authored routes, regions occupy an authored canvas, and historical geometry is protected as evidence.

Using `horn-document/0.1` as the only Horn representation therefore collapses two different things:

1. the semantic structure of an argument; and
2. the authored cartography used to present that structure.

That makes extraction, normalization, analysis, comparison, projection, and alternative authored views harder than they need to be.

## Decision

Horn has two distinct core representations.

### `horn-argument/0.1`

A geometry-free semantic argument artifact. It records:

- the issue question and issue type;
- sources used to construct the argument;
- atomic claims;
- each claim's argumentative role: position, grounds, warrant, backing, or rebuttal;
- support, dispute, and backing relationships;
- warrants attached to the support moves they license;
- the focus claim;
- argument streams and subarguments;
- source provenance and normalization notes where available.

It does not contain canvas coordinates, regions, vector routes, typography, or renderer instructions.

### `horn-document/0.1`

An authored cartographic artifact. It places semantic content into Horn's visual language using authored geometry, relation routes, regions, reading paths, and presentation metadata.

A Horn document may be constructed from a Horn argument artifact, but cartography is not a generic graph-layout operation. Geometry remains authored. Historical geometry remains evidence.

## Method pipeline

```text
source corpus
     |
     v
identify claims
     |
     v
select claims
     |
     v
normalize / write claims
     |
     v
horn-argument/0.1
  issue + focus
  atomic claims
  argumentative roles
  support/dispute structure
  streams + subarguments
     |
     v
authored cartography
     |
     v
horn-document/0.1
  geometry + roads
  regions + reading path
  visual authority
     |
     +-----------> SVG / web
     |
     +-----------> projection manifests
                         |
                         v
                  target adapters
```

This is a staged representation pipeline, not a requirement that software automatically perform every stage.

## Argument roles

The core semantic claim roles are:

- `position` — the claim advanced as a destination or conclusion of an argument;
- `grounds` — facts or data relied on to support a position;
- `warrant` — the assertion that licenses the move from grounds to a position;
- `backing` — deeper support that legitimizes a warrant;
- `rebuttal` — an exception, objection, or counterclaim directed at a position, grounds, warrant, or backing.

These names intentionally follow the handbook rather than replacing them with generic graph vocabulary.

A warrant is not a free-standing semantic edge. It belongs to a support move. `horn-argument/0.1` therefore attaches `warrantClaimId` to the relevant `supports` relation. `backs` relations run from backing claims to warrant claims. See ADR-0008.

## Structural rules

The first semantic model encodes several handbook-derived constraints:

1. A claim is atomic at the mapping level: multiple argumentative moves should not be buried in one claim merely because they appeared in one sentence or paragraph.
2. A focus claim answers the issue question and anchors the argument.
3. Claims are organized into argument streams; large arguments may be divided into subarguments.
4. `supports` and `disputes` are not interchangeable labels. They express argumentative direction.
5. Warrants and backing remain explicit roles rather than being flattened into generic support nodes.
6. Source provenance is separate from the normalized claim statement.
7. Cartographic ordering and geometry are not inferred by this semantic schema.

The handbook also gives editorial and cartographic guidance — for example, preferring clear positive formulations, keeping terminology consistent, placing Supports before Disputes for readability, and beginning intellectual-history streams with the earliest statement that is subsequently disputed. Those rules may later become lint or authoring assistance. They are not all validation errors in `0.1`.

## Stable identity

Claims in a `horn-argument/0.1` artifact have stable identifiers. An authored `horn-document/0.1` representation should preserve those identities when a document node represents the same semantic claim.

Ordinary support and dispute relation identities should survive cartography as well. A semantic warrant may be realized cartographically as a separate `warrants` road, while remaining semantically attached to the support move it licenses.

`src/correspondence.ts` validates that contract.

This lets geometry, rendering, analysis, and executable projections refer to the same semantic object without copying its meaning into competing ontologies.

## Relationship to projections

ADR-0006 remains valid, but projections now sit after semantic argument structure and, when needed, after cartography.

A consumer interested only in meaning may eventually project from a Horn argument artifact. A consumer that depends on authored spatial relationships may project from a Horn document. A target adapter must state which source representation it consumes.

The first projection format remains document-based while the semantic layer stabilizes.

RUSTBELT remains a target, not part of Horn's semantic model.

## Consequences

Horn becomes a language in the stronger sense intended by the project: not a new textual programming syntax, but a portable set of semantic distinctions and transformations for turning discourse into inspectable argument structure and, separately, authored visual form.

The repository should grow downward from the existing document kernel before it grows outward into more consumers.
