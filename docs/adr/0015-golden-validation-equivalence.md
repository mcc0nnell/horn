# ADR-0015: Golden validation equivalence (Phase 1)

Status: Accepted

## Context

Phase 1 from docs/libhorn-celix.md requires the same canonical .horn.json fixtures through the TypeScript validator and a native IValidationService provider, with exact compare of normalized validation reports. No native-specific Horn semantics.

Authority for structural checks: src/validate.ts (validateHornDocument -> HornIssue[] with {code,message}).

## Decision

### Report contract

Both runtimes emit horn-validation-report/0.1 with fields version, documentContract, documentId, ok, and issues.

Rules:
- issues sorted by (code, message)
- stable key order when serializing
- schema at schema/horn-validation-report-0.1.schema.json

### Fixtures

1. maps/chinese-room-slice.horn.json
2. maps/cct-map1-small-regions.horn.json
3. maps/celix-845-specimen-001.horn.json

Listed in golden/validation/fixtures.txt. Expected reports under golden/validation/expected/ from the TypeScript validator.


### Native port

DocumentValidator ports validate.ts. Service returns report JSON. CLI horn_validate needs no Celix.

### Acceptance

golden:validation must match expected reports for all fixtures. No semantic drift. Phase 2 out of scope.
## Consequences

- Exact JSON compare catches drift.
- Celix is optional for the CLI build; the bundle registers validation when Celix is available.
- Rule changes update TypeScript first, regenerate expected reports, then port C++.
