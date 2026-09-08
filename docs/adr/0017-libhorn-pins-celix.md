# ADR-0017: libhorn pins Apache Celix

Status: Accepted

## Context

Phase 0 registered Horn services on Apache Celix, but `find_package(Celix QUIET)` consumed whatever happened to be installed on the host — or silently skipped the bundle. That is the same class of defect Specimen 001 maps: a resolved graph that is not named cannot be a reference state.

ADR-0016 left Celix bundle/container tests as remaining work. The analysis reactor CLIs do not need Celix; the contract bundle does.

Celix 3.0.0 is the version Specimen 001 records. There is no `rel/celix-3.0.0` tag; the latest release remains `rel/celix-2.4.0`. Pinning `latest` or `master` would make the bundle's runtime a moving target.

## Decision

libhorn pins an exact Apache Celix commit and fetches it into the native build prefix.

- Pin file: `native/celix-pin.json` (`horn-celix-pin/0.1`).
- Commit: `270c784d20dabd0b1f6418c7ee2195822ec9ef90` (Celix 3.0.0, 2026-08-27, after apache/celix#846). Not a floating `master` / `latest`.
- Bootstrap: `native/scripts/bootstrap-celix.sh`, invoked by CMake when `HORN_WITH_CELIX=ON` (the default).
- Host-installed Celix is not consulted. The pin is usable from a clean container (`native/Dockerfile`).
- `HORN_WITH_CELIX=OFF` still builds the analysis libraries and standalone CLIs.
- The fetched Celix is a minimal graph: utils, framework, and RCM. Shell, remote services, HTTP admin, and examples stay off.
- Platform toolchain prerequisites such as libuuid remain platform-provided. The clean container installs `uuid-dev`; the bootstrap verifies that `<uuid/uuid.h>` and `-luuid` work instead of downloading an architecture-specific distro package.

This pin is a documented safe-default for HornContractBundle. It does not warrant that the graph is Celix's canonical, released, or universally applicable dependency state. It pins the fetched Celix source and explicitly fetched source libraries; it does not attempt to content-address the compiler, libc, kernel, or platform development packages. That boundary is the same one Specimen 001 records for Celix's own SBOM.

`horn_celix` starts a real Celix framework, installs HornContractBundle, and invokes `IValidationService`, `IProjectionService`, `IQueryService`, `IExplanationService`, `IImpactService`, and `IDiffService` through service discovery. `golden:celix` compares TypeScript, native standalone CLIs, and native-under-Celix on the same contracts.

GitHub Actions is still not the runtime contract. The local golden harness and `native/Dockerfile` are.

## Consequences

Celix packaging is reproducible within the declared toolchain boundary. Analytical authority remains golden equivalence; Celix is the in-process service container, not a second ontology.

Remaining work outside this pin:

- a `%horn` Zeppelin adapter that discovers these services;
- native domain-type ABI freeze (gated on semantic-core stability);
- extraction/correspondence golden coverage;
- treating `HornContractRuntime` as a long-running container. `horn_celix` is the conformance driver.
