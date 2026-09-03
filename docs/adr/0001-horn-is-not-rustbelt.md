# ADR-0001 — Horn is not RUSTBELT

Status: accepted  
Date: 2026-09-02

## Decision

Horn is a standalone project. It does not live in the RUSTBELT reactor, does not share RUSTBELT’s six-domain model, and is not a game.

## Why

RUSTBELT is a closed Java 21 kernel: `apply(state, op)`, receipts, WORLD / MEDIA / CORPUS / VERBS / RULES / CONSTRAINTS. Treating a Horn mural as a world-graph with `dial` / `blocked` / `powers` is a category error. A poster is a document with authored geometry and two citation layers. A game composition is a different object.

Three things were being called “Horn”:

1. The corpus (posters, argumentation maps, visual language).
2. Horn the product — an executable, navigable computational medium for that language.
3. The Fabric / world-graph currently in RUSTBELT / SCUMM3. That stays in RUSTBELT and should be renamed off Horn.

## Consequences

- New public repo `mcc0nnell/horn`, Apache-2.0 for code. Corpus stays private if and when it exists. Do not create `horn-corpus` in this slice.
- Web-native mural (SVG/DOM camera over poster-space). Portable `.horn.json`. TypeScript validator. No Java, no Maven.
- Authored geometry is canonical. No force-directed / ELK / Dagre layout on historical maps.
- Two citation layers on every debate claim: mapped (the printed debate) and cartographic (how the sheet was drawn).
- Historical vs authored is a first-class `authority` field. Authored nodes are illegal inside a historical document and must be visually marked.
- The only later coupling to RUSTBELT is optional consumption of published Horn JSON as corpus/poster data — never the other way around.

## v1

The Chinese Room cluster: twelve nodes, Turing vs Searle, one authored gloss. A mural you can enter.
