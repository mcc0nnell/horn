#!/usr/bin/env bash
set -euo pipefail

: "${ZEPPELIN_HOME:?ZEPPELIN_HOME must point to an Apache Zeppelin 0.12.0 distribution}"

REPO_ROOT="${HORN_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ZEPPELIN_URL="${ZEPPELIN_URL:-http://127.0.0.1:8080}"
FIXTURE="$REPO_ROOT/zeppelin/notebooks/chinese-room-z1-horn.json"
export HORN_REPO="$REPO_ROOT"
export HORN_CELIX="${HORN_CELIX:-$REPO_ROOT/build/native/horn_celix}"

fail() {
  echo "HORN-Z1 native interpreter failure: $*" >&2
  exit 1
}

stop_zeppelin() {
  "$ZEPPELIN_HOME/bin/zeppelin-daemon.sh" stop >/dev/null 2>&1 || true
}
trap stop_zeppelin EXIT

wait_for_zeppelin() {
  for _ in $(seq 1 90); do
    if curl -fsS "$ZEPPELIN_URL/api/notebook" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  fail "Zeppelin did not become ready"
}

run_note() {
  local note_id="$1"
  local output_file="$2"

  curl -fsS -X POST "$ZEPPELIN_URL/api/notebook/job/$note_id" >/dev/null

  for _ in $(seq 1 180); do
    local note
    note="$(curl -fsS "$ZEPPELIN_URL/api/notebook/$note_id")"

    if jq -e '.body.paragraphs | any(.[]; (.status == "ERROR" or .status == "ABORT" or .status == "CANCELLED"))' <<<"$note" >/dev/null; then
      printf '%s\n' "$note" >"$output_file"
      jq -r '.body.paragraphs[] | select(.status == "ERROR" or .status == "ABORT" or .status == "CANCELLED") | {title, text, status, results}' "$output_file" >&2 || true
      fail "note $note_id entered a failed paragraph state"
    fi

    if jq -e '.body.paragraphs | length > 0 and all(.[]; .status == "FINISHED")' <<<"$note" >/dev/null; then
      printf '%s\n' "$note" >"$output_file"
      return 0
    fi

    sleep 2
  done

  fail "note $note_id did not finish"
}

paragraph_data() {
  local note_file="$1"
  local command="$2"
  local result_type="$3"

  jq -r --arg command "$command" --arg type "$result_type" '
    [
      .body.paragraphs[]
      | select(.text | contains($command))
      | .results.msg[]?
      | select(.type == $type)
      | .data
    ]
    | join("")
  ' "$note_file"
}

assert_note() {
  local note_file="$1"
  local manifest_out="$2"
  local signature_out="$3"

  local runtime manifest validate inspect query explain impact diff network audit mural digest expected_pin
  runtime="$(paragraph_data "$note_file" "%horn runtime" "TEXT")"
  manifest="$(paragraph_data "$note_file" "%horn manifest" "TEXT")"
  validate="$(paragraph_data "$note_file" "%horn validate" "TEXT")"
  inspect="$(paragraph_data "$note_file" "%horn inspect" "TEXT")"
  query="$(paragraph_data "$note_file" "%horn query" "TEXT")"
  explain="$(paragraph_data "$note_file" "%horn explain" "TEXT")"
  impact="$(paragraph_data "$note_file" "%horn impact" "TEXT")"
  diff="$(paragraph_data "$note_file" "%horn diff" "TEXT")"
  mural="$(paragraph_data "$note_file" "%horn render" "HTML")"
  network="$(paragraph_data "$note_file" "%horn network" "NETWORK")"
  audit="$(paragraph_data "$note_file" "%horn audit" "TEXT")"
  expected_pin="$(jq -er '.celix.commit' "$REPO_ROOT/native/celix-pin.json")"

  [[ -n "$runtime" ]] || fail "%horn runtime did not produce Celix probe output"
  [[ -n "$query" ]] || fail "%horn query did not produce TEXT output"
  [[ -n "$explain" ]] || fail "%horn explain did not produce TEXT output"
  [[ -n "$impact" ]] || fail "%horn impact did not produce TEXT output"
  [[ -n "$diff" ]] || fail "%horn diff did not produce TEXT output"
  [[ -n "$mural" ]] || fail "%horn render did not produce native HTML"
  [[ -n "$network" ]] || fail "%horn network did not produce native NETWORK output"

  jq -e --arg pin "$expected_pin" '
    .version == "horn-celix-probe/0.1"
    and .ok == true
    and .pin.commit == $pin
    and ([.services[].interface] | index("horn::IValidationService") != null)
    and ([.services[].interface] | index("horn::IProjectionService") != null)
    and ([.services[].interface] | index("horn::IQueryService") != null)
    and ([.services[].interface] | index("horn::IExplanationService") != null)
    and ([.services[].interface] | index("horn::IImpactService") != null)
    and ([.services[].interface] | index("horn::IDiffService") != null)
  ' <<<"$runtime" >/dev/null \
    || fail "runtime probe did not expose the pinned libhorn Celix service plane"
  jq -e '.projectionContract == "horn-zeppelin/0.1" and .renderer == "horn-svg"' <<<"$manifest" >/dev/null \
    || fail "manifest contract is missing or wrong"
  jq -e '.version == "horn-validation-report/0.1" and .ok == true and (.issues | length == 0)' <<<"$validate" >/dev/null \
    || fail "Celix validation did not report a clean HORN document"
  jq -e '
    .version == "horn-inspect/0.1"
    and .runtime == "horn-runtime/0.1"
    and .validation.ok == true
    and .projections.argument.version == "horn-projection/0.1"
    and .projections.timeline.version == "horn-projection/0.1"
    and .projections.evidence.version == "horn-projection/0.1"
    and .projections.frontier.version == "horn-projection/0.1"
  ' <<<"$inspect" >/dev/null \
    || fail "Celix inspect did not compose the expected headless projection packet"
  jq -e '
    .version == "horn-query-result/0.1"
    and .runtime == "horn-runtime/0.1"
    and .ok == true
    and .op == "node-lookup"
    and .node.id == "c1-machines-can-think"
  ' <<<"$query" >/dev/null \
    || fail "Celix query did not return the expected node lookup contract"
  jq -e '
    .version == "horn-explanation/0.1"
    and .runtime == "horn-runtime/0.1"
    and .ok == true
    and .identity == "c1-machines-can-think"
  ' <<<"$explain" >/dev/null \
    || fail "Celix explanation did not return the expected identity contract"
  jq -e '
    .version == "horn-impact-report/0.1"
    and .runtime == "horn-runtime/0.1"
    and .mutatesSource == false
    and .documentId == "horn:authored:2026:celix-845-specimen-001"
  ' <<<"$impact" >/dev/null \
    || fail "Celix impact report weakened the non-mutating evidence boundary"
  jq -e '
    .version == "horn-diff/0.1"
    and .runtime == "horn-runtime/0.1"
    and .before.documentId == "horn:authored:2026:chinese-room"
    and .after.documentId == "horn:authored:2026:chinese-room"
    and (.authoredGeometry | length) == 0
    and (.content | length) == 0
  ' <<<"$diff" >/dev/null \
    || fail "Celix identity diff did not preserve the authored/derived boundary"
  jq -e '.hornProjection.fidelity == "lossy-semantic-projection" and .hornProjection.roundTrip == false' <<<"$network" >/dev/null \
    || fail "network weakened the lossy/non-round-trip boundary"
  jq -e '(.layerA | length) > 0 and (.layerB | length) > 0 and all(.layerA[]; .layer == "mapped") and all(.layerB[]; .layer == "cartographic")' <<<"$audit" >/dev/null \
    || fail "audit collapsed Layer A and Layer B provenance"

  digest="$(jq -er '.sha256' <<<"$manifest")"
  grep -F "data-horn-sha256=\"$digest\"" <<<"$mural" >/dev/null \
    || fail "mural is not bound to the manifest digest"
  jq -e --arg digest "$digest" '.hornProjection.sourceSha256 == $digest' <<<"$network" >/dev/null \
    || fail "network is not bound to the manifest digest"
  jq -e --arg digest "$digest" '.document.sha256 == $digest' <<<"$audit" >/dev/null \
    || fail "audit is not bound to the manifest digest"

  printf '%s\n' "$manifest" >"$manifest_out"
  jq -c '{
    nodes: (.nodes | map(.id) | sort),
    edges: (.edges | map({id: .id, source: .source, target: .target, label: .label}) | sort_by(.id)),
    loss: .hornProjection
  }' <<<"$network" >"$signature_out"
}

if [[ ! -x "$HORN_CELIX" ]]; then
  cmake -S "$REPO_ROOT/native" -B "$REPO_ROOT/build/native" -DHORN_WITH_CELIX=ON
  cmake --build "$REPO_ROOT/build/native" --parallel
fi
[[ -x "$HORN_CELIX" ]] || fail "horn_celix was not built at $HORN_CELIX"
"$HORN_CELIX" probe >/dev/null || fail "pinned horn_celix runtime probe failed before Zeppelin startup"
(
  cd "$REPO_ROOT"
  npm run golden:celix
) || fail "golden:celix failed before Zeppelin startup"

"$ZEPPELIN_HOME/bin/zeppelin-daemon.sh" start
wait_for_zeppelin

# The custom interpreter must be visible as a registered Zeppelin setting before
# the notebook executes. This endpoint also gives useful diagnostics if template
# discovery fails.
if ! curl -fsS "$ZEPPELIN_URL/api/interpreter/setting" | jq -e '.body | any(.[]; .group == "horn" or .name == "horn")' >/dev/null; then
  fail "Zeppelin did not register the HORN interpreter setting"
fi

create_response="$(
  curl -fsS -X POST \
    -H 'Content-Type: application/json' \
    --data-binary "@$FIXTURE" \
    "$ZEPPELIN_URL/api/notebook"
)"
first_note_id="$(jq -er '.body' <<<"$create_response")"

first_note="$(mktemp)"
first_manifest="$(mktemp)"
first_signature="$(mktemp)"
run_note "$first_note_id" "$first_note"
assert_note "$first_note" "$first_manifest" "$first_signature"

exported_response="$(mktemp)"
exported_note="$(mktemp)"
curl -fsS "$ZEPPELIN_URL/api/notebook/export/$first_note_id" >"$exported_response"
jq -er '.body' "$exported_response" >"$exported_note"
jq -e '.name and (.paragraphs | length > 0)' "$exported_note" >/dev/null \
  || fail "Zeppelin export did not contain a serialized note"

import_response="$(
  curl -fsS -X POST \
    -H 'Content-Type: application/json' \
    --data-binary "@$exported_note" \
    "$ZEPPELIN_URL/api/notebook/import?notePath=HORN-Z1%20Native%20Reimport"
)"
second_note_id="$(jq -er '.body' <<<"$import_response")"

second_note="$(mktemp)"
second_manifest="$(mktemp)"
second_signature="$(mktemp)"
run_note "$second_note_id" "$second_note"
assert_note "$second_note" "$second_manifest" "$second_signature"

first_digest="$(jq -er '.sha256' "$first_manifest")"
second_digest="$(jq -er '.sha256' "$second_manifest")"
[[ "$first_digest" == "$second_digest" ]] \
  || fail "HORN document digest changed after native-interpreter Zeppelin export/import"
cmp -s "$first_signature" "$second_signature" \
  || fail "semantic identities changed after native-interpreter Zeppelin export/import"

echo "HORN-Z1 native %horn round trip passed"
echo "document sha256: $first_digest"
