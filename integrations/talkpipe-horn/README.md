# TalkPipe → Horn Map 1

This package makes TalkPipe the authoring/compile boundary for the Horn Map 1 analytical demo.

It registers three ChatterLang components:

- `hornCorpus` — source: read a machine-readable global Horn argument graph.
- `hornMapArgument` — segment: select a map and compile it to `horn-argument/0.1` plus a sibling, non-authoritative source-layout envelope for ECharts.
- `hornWriteJson` — segment: persist the derived bundle without consuming it.

The important invariant is that source measurements never become `horn-document/0.1` geometry. The full Map 1 corpus currently has semantic relations and measured claim boxes, but not complete authored historical roads. ECharts therefore receives analytical straight edges and source-position hints only.

## Install

From the Horn repository root:

```bash
python -m pip install -e integrations/talkpipe-horn
```

## Compile Map 1

Place the machine-readable corpus graph at `global-argument-graph.json`, then run the checked-in ChatterLang pipeline:

```bash
chatterlang_script --script "$(cat integrations/talkpipe-horn/pipelines/cct-map1.chatterlang)"
```

Output:

```text
generated/cct-map1.echarts.json
```

The generated file is intentionally not checked in. It is derived from the local corpus and may contain text whose redistribution rights differ from the public-safe Horn repository.

## ECharts

`src/echarts/argument-bundle.ts` consumes the generated bundle. If all visible claims have source-measurement boxes, ECharts uses `layout: "none"` with those measured centers and `preserveAspect: "contain"` so the measured Map 1 spatial relationships are not stretched to fit the viewport. Otherwise it falls back to a force layout. Either way, the result is an analytical projection and never writes layout state back to Horn.

The Map 1 bundle also exposes its compiled argument streams as cockpit navigation targets. `listHornArgumentStreams(bundle)` returns the 11 issue streams with their claim counts and measured source-region identities where available. `mountHornArgumentECharts(...)` exposes the same summaries on `controller.streams` and supports:

```ts
controller.setStream("map1:stream:m1-i02");
controller.clearStream();
```

Selecting a stream filters only the disposable ECharts projection. Horn argument state and source measurements are unchanged, the stream focus claim remains present, and relations are included only when both endpoints remain visible. Unknown stream IDs fail closed.
