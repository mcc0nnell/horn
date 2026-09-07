# Horn Celix handbook rules runtime

This directory is the analysis-only Apache Celix runtime described by ADR-0007.

## Boundary

`.horn.json` remains canonical. This runtime discovers methodology-rule services, evaluates them against a read-only projection of a Horn document, and emits deterministic diagnostics. It does not mutate Horn documents, synthesize mural geometry, replace the TypeScript validator, or duplicate the SVG, ECharts, or Zeppelin layers.

## Profiles

Rules are namespaced by methodological source context:

- `horn.rules.1998.*` — cartographic / *Can Computers Think?* conventions.
- `horn.rules.2003.*` — authoring / *Introduction to Argumentation Mapping* conventions.

Profile selection is explicit so a 1998 cartographic convention is not silently treated as a universal 2003 authoring rule.

## Runtime commands

Start `HornRulesContainer`, then use the Celix shell:

```text
horn::rules
horn::analyze <document.horn.json> --profile horn-1998
horn::analyze <document.horn.json> --profile horn-2003
```

`horn::rules` proves dynamic discovery: it lists the `IHornRule` services currently registered in the framework.

`horn::analyze` loads only the small read-only projection needed by the rule API, selects services by methodology profile, evaluates them, sorts diagnostics deterministically, and prints their provenance.

## First rule set

- `horn.rules.1998.focus-box`
- `horn.rules.1998.argument-reading-direction`
- `horn.rules.2003.claim-atomicity`
- `horn.rules.2003.focus-claim-formulation`

Rules report diagnostics and optional suggestions only.

## Canonical-document adapter

The adapter follows the existing `horn-document/0.1` shape rather than inventing a parallel format. It currently projects:

- document: `id`, `version`, `authority`, `issueQuestion`
- nodes: `id`, `kind`, `label`, `text`, `focus`, `number`, `year`
- relations: `id`, `kind`, `from`, `to`, `label`

Geometry, citations, reading paths, and the rest of the canonical document remain owned by the existing Horn kernel. They are intentionally not copied into the rule view until a source-grounded rule requires them.

## Source handling

Horn's books and original map sheets remain external source material. The public repository contains distilled rule behavior and provenance references — not reproduced handbook pages or original map text/images.

## Build

See [`BUILDING.md`](BUILDING.md). Apache Celix and RapidJSON must be discoverable by CMake.
