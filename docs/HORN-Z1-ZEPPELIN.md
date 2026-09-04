# HORN-Z1 — Zeppelin Runtime Adapter

Status: implementation assignment

## Mission

Make a HORN map executable inside Apache Zeppelin without moving semantic authority out of HORN.

The first milestone must prove that a canonical `horn-document/0.1` artifact can travel into a Zeppelin notebook, render as an authored mural, expose a semantic/debug projection, and retain its evidence trail without allowing Zeppelin to invent layout or become a second document model.

The governing rule is:

> **HORN owns meaning and geometry. Zeppelin owns interaction and execution.**

HORN-Z1 is successful when the existing Chinese Room slice can be imported into Zeppelin, rendered from its authored geometry, inspected as a graph projection, audited back to its provenance, exported as a portable notebook artifact, and reproduced without semantic drift.

## Existing HORN contract

This work starts from the repository as it exists today:

- `.horn.json` is the portable document kernel.
- authored geometry is document data, not renderer inference.
- historical relation routes must be preserved rather than reconstructed by a graph layout engine.
- `src/render/svg.ts` is a pure renderer and must remain one.
- Layer A mapped provenance and Layer B cartographic provenance remain distinct.
- historical and after-Horn authored content must never be silently mixed.
- RUSTBELT is not part of this runtime boundary.

HORN-Z1 must preserve every one of those invariants.

## Non-goals

Z1 does **not**:

- invent a second HORN source language;
- replace `.horn.json` with Zeppelin note state;
- infer or regenerate relation routes;
- convert Horn murals into generic force-directed graphs;
- mutate canonical documents from notebook UI state;
- merge HORN into RUSTBELT;
- attempt a facsimile reconstruction of unpublished MacroVU material;
- upstream a HORN interpreter into Zeppelin before the adapter contract is proven.

A textual HORN authoring language may be explored later, but only as a compiler into the canonical HORN document model.

## Architecture

```text
canonical .horn.json
        |
        v
validateHornDocument()
        |
        +-----------------------------+
        |                             |
        v                             v
renderHornSvg()                Zeppelin projections
        |                     /        |        \
        v                    v         v         v
 authored mural          network     audit     metadata
        |                    |         |         |
        +--------------------+---------+---------+
                             |
                             v
                      Zeppelin notebook
```

The notebook is a runtime envelope around a HORN document. It is not the document kernel.

### Authority boundary

The canonical semantic state is always the validated `HornDocument`.

Zeppelin may hold either:

1. a reference to a canonical `.horn.json` file plus a content digest; or
2. an exact embedded snapshot of that document plus a content digest.

If an embedded snapshot differs from the expected digest, execution must fail visibly rather than silently accepting drift.

Notebook controls may alter view state — focus, zoom, selected node, selected relation, projection mode — but must not change authored canvas geometry or relation routes in Z1.

## Why Zeppelin fits

Apache Zeppelin 0.12 provides three primitives HORN-Z1 needs:

- custom interpreters invoked from notebook paragraphs;
- `%html` output for the authored SVG mural;
- `%network` output for a labelled property-graph projection;
- notebook REST operations for create, get, run, export, and import.

References:

- https://zeppelin.apache.org/docs/latest/development/writing_zeppelin_interpreter.html
- https://zeppelin.apache.org/docs/latest/usage/display_system/basic.html
- https://zeppelin.apache.org/docs/latest/usage/rest_api/notebook.html

The `%network` view is useful only as a semantic/debug projection. It is explicitly **not** a substitute for the authored mural because it does not preserve Horn's spatial grammar or route geometry.

## Z1 transport contract

Before coupling HORN to a JVM interpreter, define a transport-neutral adapter surface in this repository.

Suggested commands:

```text
horn-zeppelin validate <document>
horn-zeppelin render <document>
horn-zeppelin network <document>
horn-zeppelin audit <document>
horn-zeppelin manifest <document>
```

The implementation may begin as a Node 22 CLI because the HORN kernel is TypeScript today. The CLI must call the same validator and renderer used by repository tests rather than reimplementing either contract.

### `validate`

Input: canonical HORN JSON.

Output: machine-readable validation result.

A validation failure is terminal for `render`, `network`, and `audit`.

### `render`

Input: validated `HornDocument`.

Output: Zeppelin-compatible HTML containing the SVG returned by the existing pure renderer.

Requirements:

- no layout engine;
- no endpoint-to-endpoint relation reconstruction;
- no mutation of document geometry;
- existing renderer warnings remain visible;
- document strings must not become unescaped executable HTML.

### `network`

Input: validated `HornDocument`.

Output: Zeppelin `%network` JSON.

Mapping:

- HORN node id -> network node id;
- HORN node kind -> node label/type;
- HORN relation id -> network edge id;
- `from` -> source;
- `to` -> target;
- relation kind -> edge label/type;
- selected provenance identifiers -> property data.

The network projection must be marked as **lossy** because authored position, region geometry, relation route commands, label geometry, typography, and reading-path semantics are not fully represented by Zeppelin's graph model.

No data emitted by `%network` may be round-tripped back into a canonical HORN document in Z1.

### `audit`

Input: validated `HornDocument`.

Output: a table/JSON projection sufficient to answer:

- What source supports this mapped claim?
- What cartographic provenance governs this mural?
- Is this node historical or after-Horn authored content?
- What relation connects these claims?
- Does the relation carry persisted route geometry?
- What document/version/digest produced this notebook result?

Layer A and Layer B must remain separate fields.

### `manifest`

Output at minimum:

```json
{
  "hornSchema": "horn-document/0.1",
  "documentId": "...",
  "sha256": "...",
  "renderer": "horn-svg",
  "projectionContract": "horn-zeppelin/0.1"
}
```

The exact document identifier field should follow the existing schema rather than introducing a parallel identity system.

## Zeppelin notebook contract

The first notebook should be built around `maps/chinese-room-slice.horn.json`.

Recommended paragraph sequence:

1. **About** — Markdown describing the specimen and its authority boundary.
2. **Manifest** — HORN schema, document identity, digest, authored/historical status.
3. **Validate** — explicit validation result.
4. **Mural** — canonical SVG render in `%html`.
5. **Network** — lossy semantic/debug projection in `%network`.
6. **Audit** — provenance and relation evidence table.
7. **Notes** — explanation that graph interaction cannot rewrite authored geometry.

The mural is the primary representation. The network is an inspection tool.

## Interpreter strategy

Do this in two steps.

### Z1-A — prove the adapter

Build and test the transport-neutral HORN adapter/CLI first.

Use a minimal Zeppelin notebook fixture that invokes the adapter and demonstrates all four projections. This may use an existing Zeppelin execution path while the contract is still moving.

The purpose of Z1-A is to prove that the HORN kernel can enter Zeppelin without semantic duplication.

### Z1-B — add `%horn`

Once the adapter output contract is stable, add a thin custom Zeppelin interpreter.

Conceptual paragraph forms:

```text
%horn.render
maps/chinese-room-slice.horn.json
```

```text
%horn.network
maps/chinese-room-slice.horn.json
```

```text
%horn.audit
maps/chinese-room-slice.horn.json
```

The JVM-side interpreter should remain a thin transport adapter. It must not acquire independent HORN validation, layout, provenance, or rendering logic.

If the interpreter invokes the Node adapter as a subprocess, the executable path and Node runtime must be explicit configuration and failures must preserve stderr/exit status for diagnosis. A later service boundary may replace the subprocess if deployment experience justifies it.

## Proposed repository shape

```text
src/
  zeppelin/
    adapter.ts
    manifest.ts
    network.ts
    audit.ts
    cli.ts
    *.test.ts

zeppelin/
  README.md
  interpreter/          # Z1-B thin JVM adapter
  notebooks/
    chinese-room-z1.json

docs/
  HORN-Z1-ZEPPELIN.md
```

Do not move existing renderer or validator code under `zeppelin/`. Zeppelin depends on HORN; HORN core does not depend on Zeppelin.

## Evidence-preservation rules

HORN-Z1 must enforce these rules at every boundary:

1. **Validate before projection.** Invalid HORN documents do not render partially.
2. **No invented geometry.** Missing route geometry follows existing HORN validation/render policy; Zeppelin never fills it in.
3. **Keep provenance layers distinct.** Mapped-source evidence and cartographic evidence never collapse into one generic `source` field.
4. **Label lossy views.** `%network` is a projection, not a serialization format.
5. **Bind notebook results to input.** Every rendered notebook artifact exposes the source document digest.
6. **Preserve warnings.** Renderer or adapter warnings remain observable in notebook output.
7. **No hidden mutation.** View interaction cannot rewrite HORN document semantics in Z1.
8. **No raw HTML injection.** Document content passes through the renderer's escaping/safety boundary before Zeppelin receives `%html`.

## Test plan

### Unit

- valid HORN document produces a manifest and digest;
- invalid HORN document blocks every downstream projection;
- network projection preserves all node and relation identities;
- network projection identifies itself as lossy;
- audit output preserves Layer A and Layer B separately;
- SVG adapter output is the existing renderer output, not a second renderer;
- authored route commands survive unchanged to the mural path;
- hostile document text cannot escape into executable notebook HTML.

### Golden fixture

Use `maps/chinese-room-slice.horn.json` as the first executable specimen.

Assert:

- existing repository validation remains green;
- all existing relations still have their persisted routes;
- mural output contains every expected HORN node/relation marker;
- network output contains the same semantic node/relation identities;
- graph projection does not claim geometric fidelity;
- audit output identifies the authored reconstruction provenance;
- manifest digest is stable for identical bytes.

### Zeppelin integration

Against Zeppelin 0.12:

- import the fixture notebook;
- run all paragraphs;
- verify mural HTML is rendered;
- verify network JSON is accepted;
- verify audit output is readable;
- export and re-import the notebook;
- rerun and verify the HORN source digest and semantic projection remain identical.

## HORN-Z1 acceptance criteria

Z1 is complete when all of the following are true:

- [ ] `npm run check` remains green.
- [ ] The canonical Chinese Room `.horn.json` remains the source of truth.
- [ ] A HORN adapter validates the document before any Zeppelin projection.
- [ ] The existing pure SVG renderer is reused without adding layout behavior.
- [ ] Zeppelin displays the authored mural successfully.
- [ ] Zeppelin displays a directed network/debug projection with every HORN node and relation represented.
- [ ] The network view is explicitly identified as lossy and cannot overwrite the document.
- [ ] Zeppelin displays a provenance audit preserving Layer A and Layer B separately.
- [ ] Notebook output exposes the exact HORN document digest.
- [ ] A portable notebook fixture survives Zeppelin export/import and reproduces the same document identity and semantic projection.
- [ ] No notebook interaction changes authored geometry.
- [ ] Tests cover invalid input, projection fidelity, provenance separation, digest binding, and HTML safety.

## Definition of the milestone

**HORN-Z1: Executable Horn Map Prototype in Zeppelin**

One canonical HORN document. One Zeppelin notebook. One authored mural. One semantic/debug graph. One provenance trail. One reproducible document identity.

If those are all visibly the same argument, with geometry and evidence surviving the boundary, the architecture is proven.

The next milestone can then make `%horn` pleasant to author and operate. Z1 is about proving that the notebook can become a live scholarly vessel **without taking the map away from HORN**.
