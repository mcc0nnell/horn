# HORN on Apache Zeppelin

This directory contains the Zeppelin-side fixtures for HORN-Z1.

The authority boundary is unchanged: `.horn.json` is the canonical document. Zeppelin is a runtime envelope around it.

## Z1-A shell bridge

Before the custom `%horn` interpreter exists, Zeppelin 0.12 can exercise the transport-neutral adapter through its built-in `%sh` interpreter.

Prerequisites on the Zeppelin host:

- Node.js 22+
- this repository checked out and dependencies installed with `npm install`
- Zeppelin's Shell interpreter enabled (the default interpreter name is `%sh`)

If Zeppelin starts in the repository root, no extra configuration is needed. Otherwise set `HORN_REPO` in the Shell interpreter environment to the absolute checkout path.

The fixture at [`notebooks/chinese-room-z1.json`](notebooks/chinese-room-z1.json) is a REST create-note payload. Submit it to Zeppelin 0.12's `POST /api/notebook` endpoint, or copy its paragraph texts into a note.

Each executable paragraph runs the same adapter used by repository tests:

```sh
npm run --silent horn-zeppelin -- manifest maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- validate maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- render maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- network maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- audit maps/chinese-room-slice.horn.json
```

`render` emits a Zeppelin `%html` result. `network` emits Zeppelin `%network` JSON. The network is intentionally a lossy semantic/debug projection and is never a serialization source for HORN.

The next step is to run this fixture against Zeppelin 0.12, export the resulting note, re-import it, and compare the manifest digest and semantic identities. Only after that contract is proven should Z1-B add a thin custom `%horn` interpreter.
