# The Horn Story

## From the hallway to a language

Horn began with the posters.

The first instinct was visual: preserve the scale, the roads, the claim boxes, the argument areas, and the strange feeling that a page was not really a page at all. It was a place you could enter. That led to the first document kernel, `horn-document/0.1`: a format in which geometry, provenance, and relation routes are authored data. The Chinese Room slice proved that the mural could be encoded, validated, rendered, and navigated without turning it into a generic graph.

That was necessary, but it was not the whole thing.

The breakthrough came from reading Robert E. Horn's *Introduction to Argumentation Mapping* as a technical document rather than as a style guide. The handbook does not merely explain what the finished maps look like. It describes a transformation process: choose sources, identify claims, split buried propositions, normalize wording, distinguish issues, assemble argument streams, identify umbrella claims, select a focus claim, and divide large debates into submaps.

That changed the architecture.

The poster is not the language. The normalized argument is the language. The poster is one authored projection of it.

## Two layers, not one

Horn now has two distinct intermediate forms.

The first is the **semantic core**. It represents the argument recovered from sources: issues, claims, provenance, support, dispute, streams, context, focus claims, and subdebates. It intentionally knows nothing about coordinates, typography, or page geometry.

The second is the **document kernel**. It represents an authored or historical Horn mural. At that layer geometry is semantic. Roads are preserved. Regions have authored locations. Historical maps are never silently re-laid out. An authored reconstruction says that it is authored.

The pipeline is therefore:

```text
sources
  ↓
passages
  ↓
HORN semantic core
  ↓
cartographic authoring / compilation
  ↓
horn-document
  ↓
renderer + camera
```

The two rules that once looked contradictory are both correct:

- semantic HORN must not depend on poster geometry;
- a finished Horn document must preserve authored geometry as meaning.

They apply at different layers.

## What the handbook gave us

The handbook supplied the missing front end.

An argument begins with an **issue**, usually expressible as a question. Horn distinguishes issues of fact, action, terminology, ethics, law, goals, means, and explanation. A **focus claim** answers that issue. Claims are then connected into streams of support and dispute.

Horn's strongest editorial rule is simple: one argumentative proposition per box. Prose is therefore not the semantic representation. A sentence can contain several claims; claims that sit next to one another in a source can belong to different argument streams; claims from different sources can belong to the same stream. Source order and argument order are different things.

That is compiler territory.

The handbook also makes clear that mapping is iterative. Early claims are provisional. Later rebuttals can expose assumptions that force earlier claims to be rewritten. Working maps can carry research debt: missing evidence, unresolved sourcing, verification work, and claims that still need a direct statement from a protagonist.

HORN 0.2 turns those working states into machine-readable data without pretending they are truth values.

## The semantic core

The first semantic specification deliberately stays small.

A debate has one issue and one focus claim. Claims have stable identity independent of wording. Source passages remain distinct from normalized propositions. The base graph has two relations: `supports` and `disputes`. Toulmin-style roles such as position, ground, warrant, backing, and rebuttal are annotations on claims rather than a second competing graph algebra.

That is intentionally narrower than `horn-document/0.1`, whose cartographic vocabulary can preserve richer source-derived relations such as `warrants`, `addresses`, and `interprets-as` when a particular mural requires them. The semantic core is the argument before cartography; the document kernel is the authored map after cartography.

The default display profile is **Title is the Claim**. The proposition itself is the primary node heading, with classical or topic titles retained as aliases when useful. That choice matters because the same semantic argument can then be rendered as an outline, tree, interactive graph, or mural without changing what the claim is.

## The first golden fixture

The cloning terminology example is the first semantic conformance fixture.

It is not a facsimile of a MacroVU sheet. It is a clean-room encoding of the argument structure: one terminology issue, one focus claim, supporting lines, a rebuttal, source-grounding metadata, and a Title-is-the-Claim profile.

The fixture exists twice:

- as a human-authored `.horn` specimen;
- as canonical JSON IR validated by the HORN 0.2 schema.

That gives the language a concrete test: if a future parser, validator, compiler, or renderer cannot preserve that structure, it is not conforming to the semantic core.

## What this means for the project

Horn is no longer only a renderer for reconstructed argument murals.

It is becoming a compiler pipeline for argument.

The document kernel remains the place where authored spatial meaning is protected. The semantic core becomes the place where source material is transformed into claims and relations before anyone decides where those claims live on a wall.

The next milestone is executable rather than conceptual:

```text
horn validate examples/cloning-terminology/cloning.golden.horn
horn compile examples/cloning-terminology/cloning.golden.horn
horn render ...
```

After that, the hard problem begins: compiling a corpus into candidate claims, normalizing them, finding relations and streams, surfacing research debt, and asking a human to approve the focus and the final map.

The original posters showed that arguments could become places.

The handbook showed how arguments become maps.

HORN is the attempt to make that transformation executable without erasing the cartographer.
