# ADR-0019: Celix owns ephemeral reasoning sessions

- Status: Accepted
- Date: 2026-09-08
- Supersedes: the composition-ownership portion of ADR-0018

## Context

ADR-0018 established the essential authority rule for notebook composition: derived analysis results may be named and reused, but they are ephemeral and may never silently become canonical HORN documents.

The first implementation placed binding storage, JSON Pointer resolution, binding replacement, result digests, and temporary JSON materialization in the Zeppelin Java interpreter. That preserved the authority boundary, but it made the notebook adapter the owner of composition semantics.

The libhorn runtime already exposes validation, query, explanation, impact, and diff services through Apache Celix. Composition belongs with that service plane rather than with one UI adapter.

## Decision

Celix owns reasoning-session composition through `horn::IReasoningSessionService`.

The service contract is serialized JSON:

- `horn-reasoning-session/0.1` — transported ephemeral state;
- `horn-reasoning-session-request/0.1` — previous session plus one operation;
- `horn-reasoning-session-response/0.1` — operation result plus updated session;
- `horn-reasoning-bindings/0.1` — inspectable binding metadata.

`IReasoningSessionService` is intentionally state-carrying by envelope rather than process-persistent. Each request supplies the prior session envelope. The service resolves references, invokes other discovered Horn services, and returns the updated envelope. A caller may therefore use a fresh `horn_celix` process for each step without moving composition semantics back into that caller.

The session service owns:

1. binding-name validation;
2. `@name` and `@name#/json/pointer` resolution;
3. binding replacement;
4. deterministic binding metadata and SHA-256 digests;
5. dispatch to discovered validation, query, explanation, impact, and diff services;
6. normalization of explanation support artifacts and impact bindings;
7. the rule that canonical document operands are explicit canonical values, never binding references;
8. the `horn-reasoning-bindings/0.1` summary.

The session service does **not** own persistence. Session envelopes remain ephemeral transport state. It does not write HORN documents, admit evidence, change authored geometry, or promote derived output to canonical state.

## Zeppelin boundary

Zeppelin remains responsible for:

- note identity and lifecycle;
- paragraph syntax such as `%horn let lookup = ...`;
- resolving repository-relative source files before invocation;
- packaging literal values versus binding-reference tokens into a session request;
- retaining the returned session envelope opaquely for the next paragraph;
- displaying the operation result.

Zeppelin does not resolve JSON Pointers, calculate binding digests, decide replacement behavior, or interpret the contents of a binding. Exported notes serialize paragraphs, not session values; rerunning the note reconstructs the session by replaying Celix service calls.

## Canonical-document rule

A reasoning-session document operand uses an explicit envelope:

```json
{
  "authority": "canonical",
  "value": {
    "version": "horn-document/0.1"
  }
}
```

A derived reference such as `{"ref":"@lookup"}` is not a valid document operand. The Celix session service rejects that shape even if a caller bypasses Zeppelin. The Zeppelin adapter also rejects binding tokens in document path positions as an early transport guard.

This is defense in depth. The runtime rule is authoritative.

## Consequences

A notebook chain such as:

```text
%horn let lookup = query maps/chinese-room-slice.horn.json golden/reactor/queries/node-lookup.json
%horn let explanation = explain maps/chinese-room-slice.horn.json @lookup#/node/id
%horn bindings
```

now means:

```text
Zeppelin syntax / repository IO
        ↓
opaque horn-reasoning-session request
        ↓
IReasoningSessionService
        ↓ Celix discovery
IQueryService → binding → JSON Pointer → IExplanationService
        ↓
updated opaque session + result
```

The same composition contract can later be used by another UI, a long-running Celix container, an agent, or a remote transport without reimplementing notebook-specific binding semantics.

A future persistent or remotely addressable reasoning session may be added without changing HORN document authority. Persistence would require its own explicit contract and policy decision.
