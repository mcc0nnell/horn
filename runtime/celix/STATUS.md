# Celix handbook rules — slice status

## Implemented

- `IHornRule` C++ service contract
- deterministic diagnostic model and sort contract
- separate `horn-1998` and `horn-2003` methodology namespaces
- four initial rule implementations
- four independent Celix provider bundles
- `horn::rules` shell command backed by a live `ServiceTracker<IHornRule>`
- read-only RapidJSON adapter aligned to the canonical `horn-document/0.1` node/relation shape
- `horn::analyze <document.horn.json> --profile horn-1998|horn-2003`
- explicit profile separation so 1998 cartography is not silently treated as a universal 2003 authoring rule
- ADR-0007 authority/non-overlap boundary

## Still intentionally absent

- document mutation or rewriting
- schema changes
- SVG/ECharts/Zeppelin changes
- automatic geometry or relation repair
- copied handbook/map source text or images
- GitHub Actions

## Verification state

The source has been reviewed against the current `maps/chinese-room-slice.horn.json` shape and current Apache Celix 2.4 C++ service/bundle APIs. This environment does not contain an Apache Celix development installation, so the CMake/container build has not yet been executed here.

The next gate is a real local or external-CI Celix build, followed by a golden analysis run over `maps/chinese-room-slice.horn.json` and then a second independent specimen before any ontology expansion.
