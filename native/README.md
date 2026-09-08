# libhorn native runtime

native/ is the first Apache Celix surface for Horn.

Contract-first slice. TypeScript remains the reference while native behavior is proven by golden equivalence.

## What is here

- IRuntimeDescriptor, IValidationService (Phase 1), IProjectionService seam (Phase 2).
- horn_validation / horn_validate CLI (no Celix required).
- HornContractBundle + HornContractRuntime when Celix is available.

Service I/O remains serialized JSON artifacts.

## Build

Celix is not required for Phase 1 golden validation:

    cmake -S native -B build/native
    cmake --build build/native --target horn_validate
    ./build/native/horn_validate maps/chinese-room-slice.horn.json

If Celix is missing, only horn_validation + horn_validate are built.

When Celix is present, HornContractBundle and HornContractRuntime are also built.

## Golden validation

Install deps, then run validate:report and golden:validation.
Override native binary via HORN_VALIDATE.
Regenerate expected with compare.mjs --generate-expected.
See docs/adr/0015-golden-validation-equivalence.md.

## Next

Phase 2: golden analytical projections.
