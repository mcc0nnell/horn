# HORN-W1 — Enterable Web Specimen

## Status

Proposed first web-runtime milestone for HORN.

HORN-W1 takes one canonical HORN document and proves that it can become an enterable web experience without turning the browser into a second HORN implementation and without flattening authored cartography into generic graph layout.

The initial consumer is `mcc0nnell/web` at `/horn/enter`.

## Milestone

**One canonical HORN document. One web projection. One authored mural. One evidence inspector. One reading path. One separately reproducible Zeppelin execution surface.**

The first specimen is the Chinese Room cluster from *Can Computers Think?*:

- document: `maps/chinese-room-slice.horn.json`
- document id: `horn:authored:2026:chinese-room`
- document version: `horn-document/0.1`
- canonical source commit for W1: `f876333311337e6c39d11cc1589723ffcc9d50cf`
- source blob: `646c2091ccf1ea9bab38a0f56c1a4a9583928462`

The recovered 1998 Map 4 remains documentary evidence. The HORN document is an explicit 2026 after-Horn reconstruction, not a facsimile of the MacroVU sheet.

## Authority invariant

`.horn.json` remains the only HORN authority.

A web consumer may select and interpret canonical HORN fields for presentation. It may not acquire independent authority over:

- node identity;
- relation identity or direction;
- authored node geometry;
- authored relation routes;
- region geometry;
- reading-path order;
- source/citation bindings;
- mapped-vs-cartographic provenance distinctions.

The web surface is a projection. Browser state is never accepted as HORN serialization input.

## W1 web projection

The browser projection may carry a pinned, explicitly derived selection of the canonical document so long as the source repository, commit, path, document id, version, and blob identity travel with it.

The projection may add presentation-only state such as:

- selected node;
- current viewport;
- zoom level;
- open evidence panel;
- reading-path cursor;
- responsive presentation metadata.

None of those fields may be written back into the HORN document as recovered or authored cartography.

### Geometry rule

The page may move the window over the mural. It must not move the mural under the window.

For W1, interaction changes the SVG `viewBox` or equivalent camera state only. It does not change persisted node or route coordinates.

### Relation rule

The page renders only relations admitted by the canonical HORN document. Topic similarity, visual proximity, navigation history, or model inference may not create HORN edges.

A future exploratory layer may show inferred relationships only if they are explicitly outside HORN authority and visually distinguishable from admitted relations.

## Evidence surface

Selecting an argument object should make its evidence boundary inspectable.

At minimum, the consumer should expose:

- stable HORN object identity;
- label, kind, author, and year;
- full mapped statement in the HORN document;
- incoming/outgoing admitted relations;
- citation ids and source links where present;
- whether supporting provenance is mapped or cartographic;
- the pinned canonical document identity used by the projection.

The purpose is not merely citation display. The user should be able to tell **why the object is present and what transformation boundary produced the thing being viewed**.

## Zeppelin boundary

Apache Zeppelin is an execution envelope around HORN, not a web authority and not a replacement document model.

HORN-Z1 already defines the transport-neutral projection seam. HORN-Z1-B adds the native `%horn` interpreter separately.

W1 may expose reproducible commands such as:

```text
%horn manifest maps/chinese-room-slice.horn.json
%horn validate maps/chinese-room-slice.horn.json
%horn render maps/chinese-room-slice.horn.json
%horn network maps/chinese-room-slice.horn.json
%horn audit maps/chinese-room-slice.horn.json
```

A public web surface must not require arbitrary notebook execution in the browser.

The initial W1 page therefore shows the execution contract and links to the Zeppelin proof while rendering from its pinned HORN projection. A later live integration may consume result-only or authenticated Zeppelin output, but it must preserve the same HORN authority boundary.

## Security boundary

Direct Zeppelin notebook embedding is not required for W1.

If it is added later:

- public pages should prefer result-only or signed snapshot surfaces;
- execution endpoints must be separately authenticated and authorized;
- credentials must never be encoded in iframe or public URLs;
- raw `%html` output must not be treated as trusted merely because Zeppelin produced it;
- notebook identity and HORN document identity must remain independently visible;
- a notebook must not silently change which HORN artifact is being represented.

## W1-A acceptance proof

A conforming first web specimen should prove all of the following:

1. The consumer is pinned to one canonical HORN artifact.
2. Every projected node and relation keeps its HORN identity.
3. Every relation endpoint resolves to a projected HORN node.
4. Authored node geometry and relation routes survive projection.
5. The reading path references only admitted nodes and does not reorder itself implicitly.
6. Every projected citation reference resolves.
7. Camera interaction does not mutate document geometry.
8. The public page distinguishes the after-Horn reconstruction from the recovered 1998 map.
9. Zeppelin is presented as a reproducible execution surface rather than as semantic authority.
10. The web artifact exposes enough source identity to explain which HORN document produced it.

## W1-B — executable result seam

After W1-A is visually and behaviorally sound, add one result-only live Zeppelin seam.

The smallest useful slice is a single object or evidence panel that can retrieve a `%horn manifest` or `%horn audit` result through a restricted service boundary and compare it with the document identity displayed by the page.

Success means the live result adds reproducibility without becoming required for ordinary public reading.

## W1-C — seven-map story

Only after the one-cluster contract is stable should the web runtime expand across all seven *Can Computers Think?* maps.

The seven-map experience should preserve documentary cross-map references and authored spatial structure. It must not infer a universal graph merely because all seven maps occupy one web environment.

The larger goal is a connected story in which a reader can move from the question, through a position and objection, into primary evidence and executable analysis, while always being able to recover the source boundary.

## Relationship to other runtimes

HORN does not become RUSTBELT, Zeppelin, or Wind Anvil.

Those systems may consume HORN projections for different purposes:

- a browser can make the mural enterable;
- Zeppelin can make the document executable and reproducible;
- RUSTBELT may later interpret selected HORN projections spatially;
- Wind Anvil may later verify/sign a HORN execution or projection receipt.

None of those consumers can silently write new meaning back into HORN.

## Success criterion

W1 succeeds when someone unfamiliar with Horn can move through the Chinese Room cluster, understand how the claims support and dispute one another, inspect the evidence behind those claims, and still recover the exact HORN artifact that defined the experience.

The web should make the map easier to enter without making the source harder to audit.
