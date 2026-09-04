# Specimen 001 — Apache Celix PR #845

This experiment asks whether a naturally occurring software-engineering discussion can be reconstructed as a Horn argument map without having been authored as one.

Source specimen: Apache Celix PR #845, “Generate CycloneDX SBOM with Conan deployer.”

## Experimental boundary

The PR predates this Horn reconstruction. Its proposal, objections, revisions, maintainer comments, commits, CI, Conan configuration, and SBOM work are therefore treated as an untouched engineering record.

Horn does not reinterpret a dependency edge as an argument edge. The experiment keeps three layers distinct:

1. **Artifacts** — PR comments, commits, workflow files, Conan outputs, SBOMs, lockfiles, CI runs.
2. **Assertions** — source-grounded observations that can be extracted from those artifacts.
3. **Argument** — claims and disputes about what the evidence warrants.

The existing Horn document invariant remains intact: normative argument relations are `supports` and `disputes`. Artifact provenance and implementation relationships are recorded as citations/metadata rather than smuggled into the normative argument graph.

## Specimen question

> What exactly should an Apache Celix SBOM describe, and what does that evidence warrant?

## First reconstruction spine

The initial map preserves the observed argumentative progression:

- Proposal: generate a CycloneDX SBOM in Conan CI.
- Dispute: an SBOM should correspond to a concrete binary; a Conan recipe/test workflow is not itself the final released binary.
- Evidence/constraint: dependency overrides can change both the resolved binary graph and its SBOM without changing Celix source.
- Reformulation: deploy the resolved Conan binary packages and generate the SBOM from the same dependency-graph resolution.
- Further dispute: the workflow is testing infrastructure, not a binary release process; Celix does not make a canonical binary release.
- Emerging direction: document a safe-default/reference dependency state, with lockfile + SBOM, while allowing consumers to override it.
- Alternative artifact boundary: a maintained development container may provide a concrete distributable boundary.

The final two items remain emerging/unresolved until the upstream project makes them authoritative.

## Success criterion

Horn should be able to answer, with provenance:

> Why does this SBOM exist, what exactly does it describe, what claims does it support, what does it not warrant, and how did the project arrive at that design?

If this reconstruction works, the next experiment should use another naturally occurring engineering discussion and test whether the same grammar holds without changing the ontology to fit the specimen.
