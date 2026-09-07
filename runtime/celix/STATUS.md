# Celix handbook rules — slice status

## Implemented

- `IHornRule` C++ service contract
- deterministic diagnostic model and sort contract
- separate `horn-1998` and `horn-2003` methodology namespaces
- four initial rule implementations
- four independent Celix provider bundles
- `horn::rules` shell command backed by a live `ServiceTracker<IHornRule>`
- ADR-0007 authority/non-overlap boundary

## Intentionally not implemented yet

- `.horn.json` parser/adapter
- `horn-celix analyze` one-shot CLI
- document mutation or rewriting
- schema changes
- SVG/ECharts/Zeppelin changes

The next implementation gate is the read-only document adapter. It should be written only after checking the canonical `horn-document/0.1` TypeScript shape and choosing a small, explicit JSON dependency rather than inventing a second document model or a hand-rolled parser.
