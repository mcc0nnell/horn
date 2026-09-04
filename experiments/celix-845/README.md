# Specimen 001 — Apache Celix PR #845

This experiment asks whether a naturally occurring software-engineering discussion can be reconstructed as a Horn argument map without having been authored as one.

Source specimen: Apache Celix PR #845, “Generate CycloneDX SBOM with Conan deployer.”

## Experimental boundary

The PR predates this Horn reconstruction. Its proposal, objections, revisions, maintainer comments, commits, CI, Conan configuration, and SBOM work are therefore treated as an untouched engineering record.

Horn does not reinterpret a dependency edge as an argument edge. The experiment keeps three layers distinct:

1. **Artifacts** — PR comments, commits, workflow files, Conan outputs, SBOMs, lockfiles, CI runs.
2. **Assertions** — source-grounded observations that can be extracted from those artifacts.
3. **Argument** — claims and disputes about what the evidence warrants.

The existing Horn document invariant remains intact: normative argument relations stay in Horn's argument vocabulary. Artifact provenance and implementation relationships are recorded as citations/metadata rather than smuggled into the normative argument graph.

## Specimen question

> What exactly should an Apache Celix SBOM describe, and what does that evidence warrant?

## Reconstruction spine

The map preserves the observed argumentative progression:

- Proposal: generate a CycloneDX SBOM in Conan CI.
- Dispute: an SBOM should correspond to a concrete binary; a Conan recipe/test workflow is not itself the final released binary.
- Evidence/constraint: dependency overrides can change both the resolved binary graph and its SBOM without changing Celix source.
- Reformulation: deploy the resolved Conan binary packages and generate the SBOM from the same dependency-graph resolution.
- Further dispute: the workflow is testing infrastructure, not a binary release process; Celix does not make a canonical binary release.
- Maintainer proposal: use a representative lockfile as a reproducible dependency reference.
- Reviewer convergence: document lockfile + SBOM as a safe-default reference state while preserving downstream freedom to change dependencies and options.
- Security use: audit that reference graph as a concrete maintenance target.
- Alternative artifact boundary: a maintained development container may provide a concrete distributable boundary.

The development-container role and the final release/reference authority boundary remain unresolved until upstream implementation makes them authoritative.

## Physical evidence

`evidence/sbom-physical-evidence.json` records the actual GitHub Actions artifact and the generated CycloneDX 1.6 dependency graph from the specimen head. Those `depends_on` observations remain evidence facts; they are deliberately not Horn argument relations.

## Authored roads

Every argument relation in `maps/celix-845-specimen-001.horn.json` now has persisted route geometry. The roads are authored reconstruction geometry, not geometry recovered from Apache Celix or an original Robert E. Horn mural.

Render the specimen deterministically with:

```bash
npm run render:celix > celix-845-specimen-001.svg
```

The renderer is pure: it consumes the persisted Horn geometry and does not invent missing roads.

## Success criterion

Horn should be able to answer, with provenance:

> Why does this SBOM exist, what exactly does it describe, what claims does it support, what does it not warrant, and how did the project arrive at that design?

If this reconstruction works, the next experiment should use another naturally occurring engineering discussion and test whether the same grammar holds without changing the ontology to fit the specimen.
