# HORN on Apache Zeppelin

This directory contains the Zeppelin-side runtime and fixtures for HORN-Z1.

The authority boundary is unchanged: `.horn.json` is the canonical document. Zeppelin is a runtime envelope around it.

## Z1-B native `%horn` interpreter

The primary Zeppelin interface is the thin Java interpreter in [`interpreter/`](interpreter/). It does not implement HORN semantics.

The interpreter now has two explicit execution planes:

- **Presentation plane** — `render`, `network`, `audit`, and `manifest` delegate to the transport-neutral TypeScript adapter in `src/zeppelin/`. These remain Zeppelin-facing projections.
- **Analysis plane** — `runtime`, `validate`, and `inspect` execute `horn_celix`. That driver boots the pinned Apache Celix framework and discovers libhorn services before invoking them. Zeppelin does not reimplement or bypass the service contracts.

Supported paragraphs are:

```text
%horn runtime
%horn validate maps/chinese-room-slice.horn.json
%horn inspect maps/chinese-room-slice.horn.json
%horn manifest maps/chinese-room-slice.horn.json
%horn render maps/chinese-room-slice.horn.json
%horn network maps/chinese-room-slice.horn.json
%horn audit maps/chinese-room-slice.horn.json
```

`runtime` emits the `horn-celix-probe/0.1` service-discovery record, including the exact pinned Celix identity and registered libhorn service interfaces. `validate` invokes `IValidationService`. `inspect` composes validation, all four analytical projections, and the headless inspection packet through the Celix-backed runtime.

`render` becomes a native Zeppelin `HTML` result. `network` becomes a native `NETWORK` result. The network remains an explicitly lossy semantic/debug projection and is never accepted as HORN serialization input.

This split is deliberate: renderer concerns stay outside libhorn, while headless reasoning goes through the same Celix service plane exercised by `golden:celix`.

### Build

Prerequisites:

- JDK 11
- Maven
- Node.js 22+
- CMake 3.19+
- the native prerequisites documented in `native/README.md`
- this repository checked out with `npm install` completed

Build the pinned libhorn runtime first:

```sh
cmake -S native -B build/native -DHORN_WITH_CELIX=ON
cmake --build build/native
./build/native/horn_celix probe
npm run golden:celix
```

Then build and test the interpreter:

```sh
mvn --file zeppelin/interpreter/pom.xml verify
```

The Maven package phase also places the interpreter's runtime bootstrap dependencies in `zeppelin/interpreter/target/lib/`. Zeppelin's third-party interpreter launcher needs those dependencies beside the interpreter JAR before its remote process can start.

### Install into Zeppelin 0.12

Build the interpreter, then install the JAR, runtime dependencies, and setting descriptor into a Zeppelin interpreter directory:

```sh
mkdir -p "$ZEPPELIN_HOME/interpreter/horn"
cp zeppelin/interpreter/target/horn-zeppelin-interpreter-0.1.0-SNAPSHOT.jar \
  "$ZEPPELIN_HOME/interpreter/horn/"
cp zeppelin/interpreter/target/lib/*.jar \
  "$ZEPPELIN_HOME/interpreter/horn/"
cp zeppelin/interpreter/src/main/resources/interpreter-setting.json \
  "$ZEPPELIN_HOME/interpreter/horn/"
export HORN_REPO=/absolute/path/to/horn
```

Restart Zeppelin after installation. `HORN_REPO` identifies the checkout containing the canonical maps, TypeScript presentation adapter, and native build. `HORN_CELIX` may override the default `build/native/horn_celix` path. `HORN_NPM` and `HORN_COMMAND_TIMEOUT_MILLIS` correspond to interpreter properties `horn.npm` and `horn.command.timeout.millis`.

The native fixture is [`notebooks/chinese-room-z1-horn.json`](notebooks/chinese-room-z1-horn.json). The existing round-trip harness remains presentation-focused; the Celix service-plane contract is independently covered by `golden:celix`. A future integration slice can make the Zeppelin fixture itself assert the runtime probe without changing HORN semantics.

## Z1-A shell bridge

[`notebooks/chinese-room-z1.json`](notebooks/chinese-room-z1.json) retains the original `%sh` bridge used to prove the transport-neutral adapter before the native interpreter existed. It remains useful as an independent presentation regression path because it exercises the same HORN adapter without the Java layer.

The equivalent shell commands are:

```sh
npm run --silent horn-zeppelin -- manifest maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- validate maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- render maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- network maps/chinese-room-slice.horn.json
npm run --silent horn-zeppelin -- audit maps/chinese-room-slice.horn.json
```

The shell bridge's `validate` command still exercises the TypeScript reference implementation. The native `%horn validate` command deliberately exercises the Celix-discovered `IValidationService`, giving the two paths independent value.

Both paths enforce the same rule: **HORN owns meaning and geometry. Zeppelin owns interaction and execution.**
