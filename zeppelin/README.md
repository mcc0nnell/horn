# HORN on Apache Zeppelin

This directory contains the Zeppelin-side runtime and fixtures for HORN-Z1.

The authority boundary is unchanged: `.horn.json` is the canonical document. Zeppelin is a runtime envelope around it.

## Z1-B native `%horn` interpreter

The primary Zeppelin interface is the thin Java interpreter in [`interpreter/`](interpreter/). It does not implement HORN semantics. It validates only the execution boundary and delegates every document operation to the transport-neutral TypeScript adapter in `src/zeppelin/`.

Supported paragraphs are:

```text
%horn manifest maps/chinese-room-slice.horn.json
%horn validate maps/chinese-room-slice.horn.json
%horn render maps/chinese-room-slice.horn.json
%horn network maps/chinese-room-slice.horn.json
%horn audit maps/chinese-room-slice.horn.json
```

`render` becomes a native Zeppelin `HTML` result. `network` becomes a native `NETWORK` result. The network remains an explicitly lossy semantic/debug projection and is never accepted as HORN serialization input.

### Build

Prerequisites:

- JDK 11
- Maven
- Node.js 22+
- this repository checked out with `npm install` completed

Build and test the interpreter with:

```sh
mvn --file zeppelin/interpreter/pom.xml verify
```

### Install into Zeppelin 0.12

Build the interpreter, then install the JAR and its setting descriptor into a Zeppelin interpreter directory:

```sh
mkdir -p "$ZEPPELIN_HOME/interpreter/horn"
cp zeppelin/interpreter/target/horn-zeppelin-interpreter-0.1.0-SNAPSHOT.jar \
  "$ZEPPELIN_HOME/interpreter/horn/"
cp zeppelin/interpreter/src/main/resources/interpreter-setting.json \
  "$ZEPPELIN_HOME/interpreter/horn/"
export HORN_REPO=/absolute/path/to/horn
```

Restart Zeppelin after installation. `HORN_REPO` identifies the checkout containing the canonical maps and the TypeScript adapter. The optional `HORN_NPM` and `HORN_COMMAND_TIMEOUT_MILLIS` environment variables correspond to interpreter properties `horn.npm` and `horn.command.timeout.millis`.

The native fixture is [`notebooks/chinese-room-z1-horn.json`](notebooks/chinese-room-z1-horn.json). CI installs the interpreter into a pristine Zeppelin 0.12.0 distribution, executes the note, exports and re-imports it, and verifies that the exact HORN digest and semantic identities survive the round trip.

## Z1-A shell bridge

[`notebooks/chinese-room-z1.json`](notebooks/chinese-room-z1.json) retains the original `%sh` bridge used to prove the transport-neutral adapter before the native interpreter existed. It remains useful as an independent regression path because it exercises the same HORN adapter without the Java layer.

The equivalent shell commands are:

```sh
npm run --silent horn-zeppelin -- manifest maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- validate maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- render maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- network maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- audit maps/chinese-room-slice.horn.json
```

Both paths enforce the same rule: **HORN owns meaning and geometry. Zeppelin owns interaction and execution.**
