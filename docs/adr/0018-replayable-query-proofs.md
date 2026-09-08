# ADR-0018: Replayable query proofs

Status: Proposed

## Context

ADR-0017 defines deterministic query operations over canonical Horn artifacts. A query result by itself says what the reference implementation returned, but it does not bind that answer to the exact source document or expose which structural fields the query consulted.

Horn needs a portable proof object that can travel through libhorn, Zeppelin, ECharts, WindAnvil, or another client without asking the client to trust a rendered explanation.

## Decision

Introduce `horn-proof/0.1` for deterministic query replay and `horn-proof-verification/0.1` for verification reports.

A proof contains:

- a content-addressed proof id;
- the exact query request;
- the deterministic query result;
- a canonical SHA-256 digest of the complete Horn document;
- a smaller structural dependency witness and its own digest;
- the replay algorithm version.

The first algorithm is `horn-query-replay/0.1`.

## Canonical document digest

The document digest is computed over recursively key-sorted JSON rather than source-file whitespace. It binds the proof to the semantic JSON value while remaining stable across indentation or object-key formatting changes.

This is not a signature and makes no claim about who authored the source. Cryptographic signing, admission, and external evidence transport remain separate concerns.

## Dependency witness

The query reference currently consults a deliberately small structural surface:

- node `id` and `number`;
- relation `id`, `kind`, `from`, and `to`;
- the query request itself.

The proof records the relevant nodes and relations plus `horn-query-dependencies/0.1` SHA-256.

The full source digest and dependency digest answer different questions:

- source digest changed, dependency digest unchanged: the exact source artifact changed, but not the structural fields this query says it consulted;
- dependency digest changed: the structural input to the deterministic query changed;
- replay result changed: the answer is no longer equivalent under the current reference algorithm.

The dependency witness is descriptive and versioned. It must expand whenever a query implementation begins consulting additional fields.

## Verification

Verification receives a canonical Horn document and a proof artifact.

It recomputes:

1. the canonical document digest;
2. the dependency witness and dependency digest;
3. the deterministic query result;
4. the content-addressed proof id.

Any mismatch produces a failed `horn-proof-verification/0.1` report with explicit issue codes.

Verification never mutates either the document or proof.

## Native boundary

Reserve `horn::IProofService` as serialized-artifact orchestration:

```text
horn-document/0.1 + horn-query-request/0.1
                    |
                    v
               createProof
                    |
                    v
              horn-proof/0.1

horn-document/0.1 + horn-proof/0.1
                    |
                    v
               verifyProof
                    |
                    v
      horn-proof-verification/0.1
```

No native proof provider should be registered before the underlying native query service has golden equivalence with the TypeScript reference and proof output itself has golden coverage.

## Non-goals

A Horn proof does not prove that a philosophical claim is true.

It proves a narrower, useful statement: given this canonical Horn artifact, this versioned query, and this deterministic algorithm, this is the replayable structural result and these are the recorded structural dependencies.

## Consequences

- query answers become portable and independently replayable;
- clients can distinguish irrelevant source changes from structural dependency changes;
- WindAnvil can later admit Horn proof artifacts without becoming Horn semantic authority;
- signed attestations can wrap proof artifacts later without changing the query kernel;
- proof semantics remain testable before C++/Celix optimization.
