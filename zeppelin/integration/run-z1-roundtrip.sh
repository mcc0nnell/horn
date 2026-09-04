#!/usr/bin/env bash
set -euo pipefail

: "${ZEPPELIN_HOME:?ZEPPELIN_HOME must point to an Apache Zeppelin 0.12.0 distribution}"

REPO_ROOT="${HORN_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ZEPPELIN_URL="${ZEPPELIN_URL:-http://127.0.0.1:8080}"
FIXTURE="$REPO_ROOT/zeppelin/notebooks/chinese-room-z1.json"
export HORN_REPO="$REPO_ROOT"

fail() {
  echo "HORN-Z1 Zeppelin integration failure: $*" >&2
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

  jq -e '[.body.paragraphs[].results.msg[]?.type] | index("HTML") != null' "$note_file" >/dev/null \
    || fail "mural did not produce Zeppelin HTML"
  jq -e '[.body.paragraphs[].results.msg[]?.type] | index("NETWORK") != null' "$note_file" >/dev/null \
    || fail "network projection was not accepted as Zeppelin NETWORK output"

  local manifest validate network audit mural digest
  manifest="$(paragraph_data "$note_file" "horn-zeppelin -- manifest" "TEXT")"
  validate="$(paragraph_data "$note_file" "horn-zeppelin -- validate" "TEXT")"
  network="$(paragraph_data "$note_file" "horn-zeppelin -- network" "NETWORK")"
  audit="$(paragraph_data "$note_file" "horn-zeppelin -- audit" "TEXT")"
  mural="$(paragraph_data "$note_file" "horn-zeppelin -- render" "HTML")"

  jq -e '.projectionContract == "horn-zeppelin/0.1" and .renderer == "horn-svg"' <<<"$manifest" >/dev/null \
    || fail "manifest contract is missing or wrong"
  jq -e '.valid == true and (.issues | length == 0)' <<<"$validate" >/dev/null \
    || fail "validate projection did not report a clean HORN document"
  jq -e '.hornProjection.fidelity == "lossy-semantic-projection" and .hornProjection.roundTrip == false' <<<"$network" >/dev/null \
    || fail "network did not preserve the lossy/non-round-trip boundary"
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

"$ZEPPELIN_HOME/bin/zeppelin-daemon.sh" start
wait_for_zeppelin

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
    "$ZEPPELIN_URL/api/notebook/import?notePath=HORN-Z1%20Chinese%20Room%20Reimport"
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
  || fail "HORN document digest changed after Zeppelin export/import"
cmp -s "$first_signature" "$second_signature" \
  || fail "semantic network identities changed after Zeppelin export/import"

echo "HORN-Z1 Zeppelin round trip passed"
echo "document sha256: $first_digest"
