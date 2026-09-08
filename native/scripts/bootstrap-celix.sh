#!/usr/bin/env bash
# Bootstrap the pinned Apache Celix plus the libraries it needs into a prefix.
# Idempotent: a matching stamp skips work. Does not use a host-installed Celix.
set -euo pipefail

usage() {
  echo "Usage: bootstrap-celix.sh <prefix-dir>" >&2
  exit 2
}

PREFIX="${1:-}"
[[ -n "$PREFIX" ]] || usage

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PIN_FILE="${HORN_CELIX_PIN:-$NATIVE_DIR/celix-pin.json}"
JOBS="${HORN_BUILD_JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)}"
CMAKE_BIN="${CMAKE:-cmake}"

if ! command -v python3 >/dev/null; then
  echo "python3 is required to read $PIN_FILE" >&2
  exit 1
fi

pin_get() {
  python3 - "$PIN_FILE" "$1" <<'PY'
import json, sys
pin = json.load(open(sys.argv[1]))
path = sys.argv[2].split(".")
cur = pin
for key in path:
    if isinstance(cur, dict) and key in cur:
        cur = cur[key]
    else:
        sys.exit(1)
if isinstance(cur, (dict, list)):
    json.dump(cur, sys.stdout)
else:
    sys.stdout.write(str(cur))
PY
}

COMMIT="$(pin_get celix.commit)"
CELIX_ARCHIVE="$(pin_get celix.archive)"
CELIX_SHA="$(pin_get celix.archiveSha256)"
STAMP="$PREFIX/.horn-celix-stamp"
DEPS_PREFIX="$PREFIX/deps"
CELIX_PREFIX="$PREFIX/celix"
SRC_ROOT="$PREFIX/src"
DOWNLOADS="$PREFIX/downloads"

if [[ -f "$STAMP" ]] && [[ "$(cat "$STAMP")" == "$COMMIT" ]] \
   && [[ -f "$CELIX_PREFIX/lib/cmake/Celix/CelixConfig.cmake" || -f "$CELIX_PREFIX/lib64/cmake/Celix/CelixConfig.cmake" ]]; then
  echo "Pinned Celix $COMMIT already present in $CELIX_PREFIX"
  exit 0
fi

mkdir -p "$DEPS_PREFIX" "$CELIX_PREFIX" "$SRC_ROOT" "$DOWNLOADS"

fetch() {
  local url="$1" sha="$2" dest="$3"
  if [[ -f "$dest" ]]; then
    local have
    have="$(sha256sum "$dest" | awk '{print $1}')"
    if [[ "$have" == "$sha" ]]; then
      return 0
    fi
  fi
  echo "Downloading $url"
  curl -fsSL -L -o "$dest" "$url"
  local have
  have="$(sha256sum "$dest" | awk '{print $1}')"
  if [[ "$have" != "$sha" ]]; then
    echo "SHA256 mismatch for $dest" >&2
    echo "  expected $sha" >&2
    echo "  actual   $have" >&2
    exit 1
  fi
}

extract_tar() {
  local tgz="$1" dest="$2"
  mkdir -p "$dest"
  tar --no-same-owner --no-same-permissions -xzf "$tgz" -C "$dest"
}

cmake_build_install() {
  local src="$1"
  shift
  local build="$src/../build-$(basename "$src")"
  rm -rf "$build"
  mkdir -p "$build"
  "$CMAKE_BIN" -S "$src" -B "$build" \
    -DCMAKE_INSTALL_PREFIX="$DEPS_PREFIX" \
    -DCMAKE_INSTALL_LIBDIR=lib \
    -DCMAKE_PREFIX_PATH="$DEPS_PREFIX" \
    -DCMAKE_BUILD_TYPE=Release \
    "$@"
  "$CMAKE_BIN" --build "$build" --parallel "$JOBS"
  "$CMAKE_BIN" --install "$build"
}

export CMAKE_PREFIX_PATH="${DEPS_PREFIX}${CMAKE_PREFIX_PATH:+:$CMAKE_PREFIX_PATH}"
export PKG_CONFIG_PATH="$DEPS_PREFIX/lib/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
export CPATH="$DEPS_PREFIX/include${CPATH:+:$CPATH}"
export LIBRARY_PATH="$DEPS_PREFIX/lib${LIBRARY_PATH:+:$LIBRARY_PATH}"
export LD_LIBRARY_PATH="$DEPS_PREFIX/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# --- zlib ---
ZLIB_URL="$(pin_get libraries.zlib.archive)"
ZLIB_SHA="$(pin_get libraries.zlib.archiveSha256)"
ZLIB_TGZ="$DOWNLOADS/zlib-1.3.1.tar.gz"
fetch "$ZLIB_URL" "$ZLIB_SHA" "$ZLIB_TGZ"
if [[ ! -f "$DEPS_PREFIX/include/zlib.h" ]]; then
  rm -rf "$SRC_ROOT/zlib-1.3.1"
  extract_tar "$ZLIB_TGZ" "$SRC_ROOT"
  cmake_build_install "$SRC_ROOT/zlib-1.3.1" \
    -DZLIB_BUILD_EXAMPLES=OFF
fi

# --- libuv ---
UV_URL="$(pin_get libraries.libuv.archive)"
UV_SHA="$(pin_get libraries.libuv.archiveSha256)"
UV_TGZ="$DOWNLOADS/libuv-1.51.0.tar.gz"
fetch "$UV_URL" "$UV_SHA" "$UV_TGZ"
if [[ ! -f "$DEPS_PREFIX/include/uv.h" ]]; then
  rm -rf "$SRC_ROOT/libuv-1.51.0"
  extract_tar "$UV_TGZ" "$SRC_ROOT"
  cmake_build_install "$SRC_ROOT/libuv-1.51.0" \
    -DLIBUV_BUILD_TESTS=OFF \
    -DLIBUV_BUILD_BENCH=OFF
fi

# --- jansson ---
JAN_URL="$(pin_get libraries.jansson.archive)"
JAN_SHA="$(pin_get libraries.jansson.archiveSha256)"
JAN_TGZ="$DOWNLOADS/jansson-2.14.tar.gz"
fetch "$JAN_URL" "$JAN_SHA" "$JAN_TGZ"
if [[ ! -f "$DEPS_PREFIX/include/jansson.h" ]]; then
  rm -rf "$SRC_ROOT/jansson-2.14"
  extract_tar "$JAN_TGZ" "$SRC_ROOT"
  cmake_build_install "$SRC_ROOT/jansson-2.14" \
    -DJANSSON_BUILD_DOCS=OFF \
    -DJANSSON_WITHOUT_TESTS=ON \
    -DJANSSON_EXAMPLES=OFF
fi

# --- libzip (needs zlib) ---
ZIP_URL="$(pin_get libraries.libzip.archive)"
ZIP_SHA="$(pin_get libraries.libzip.archiveSha256)"
ZIP_TGZ="$DOWNLOADS/libzip-1.11.4.tar.gz"
fetch "$ZIP_URL" "$ZIP_SHA" "$ZIP_TGZ"
if [[ ! -f "$DEPS_PREFIX/include/zip.h" ]]; then
  rm -rf "$SRC_ROOT/libzip-1.11.4"
  extract_tar "$ZIP_TGZ" "$SRC_ROOT"
  cmake_build_install "$SRC_ROOT/libzip-1.11.4" \
    -DENABLE_COMMONCRYPTO=OFF \
    -DENABLE_GNUTLS=OFF \
    -DENABLE_MBEDTLS=OFF \
    -DENABLE_OPENSSL=OFF \
    -DENABLE_WINDOWS_CRYPTO=OFF \
    -DENABLE_BZIP2=OFF \
    -DENABLE_LZMA=OFF \
    -DENABLE_ZSTD=OFF \
    -DBUILD_TOOLS=OFF \
    -DBUILD_REGRESS=OFF \
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_DOC=OFF \
    -DBUILD_OSSFUZZ=OFF
fi

# --- uuid headers (libuuid is usually already on the host) ---
if [[ ! -f /usr/include/uuid/uuid.h && ! -f "$DEPS_PREFIX/include/uuid/uuid.h" ]]; then
  UUID_URL="$(pin_get uuidHeaderDeb.url)"
  UUID_SHA="$(pin_get uuidHeaderDeb.sha256)"
  UUID_DEB="$DOWNLOADS/uuid-dev.deb"
  fetch "$UUID_URL" "$UUID_SHA" "$UUID_DEB"
  EXTRACT="$DOWNLOADS/uuid-dev-extract"
  rm -rf "$EXTRACT"
  mkdir -p "$EXTRACT"
  dpkg-deb -x "$UUID_DEB" "$EXTRACT"
  mkdir -p "$DEPS_PREFIX/include/uuid"
  cp "$EXTRACT/usr/include/uuid/uuid.h" "$DEPS_PREFIX/include/uuid/uuid.h"
fi

if [[ ! -e "$DEPS_PREFIX/lib/libuuid.so" ]]; then
  mkdir -p "$DEPS_PREFIX/lib"
  if [[ -e /lib/x86_64-linux-gnu/libuuid.so.1 ]]; then
    ln -sfn /lib/x86_64-linux-gnu/libuuid.so.1 "$DEPS_PREFIX/lib/libuuid.so"
  elif [[ -e /usr/lib/x86_64-linux-gnu/libuuid.so.1 ]]; then
    ln -sfn /usr/lib/x86_64-linux-gnu/libuuid.so.1 "$DEPS_PREFIX/lib/libuuid.so"
  elif [[ -e /usr/lib/libuuid.so.1 ]]; then
    ln -sfn /usr/lib/libuuid.so.1 "$DEPS_PREFIX/lib/libuuid.so"
  else
    echo "libuuid.so.1 not found. Install uuid-dev in the clean container, or put libuuid in ${DEPS_PREFIX}/lib." >&2
    exit 1
  fi
fi

# --- Celix ---
CELIX_TGZ="$DOWNLOADS/celix-$COMMIT.tar.gz"
fetch "$CELIX_ARCHIVE" "$CELIX_SHA" "$CELIX_TGZ"
CELIX_SRC="$SRC_ROOT/celix-$COMMIT"
rm -rf "$CELIX_SRC"
extract_tar "$CELIX_TGZ" "$SRC_ROOT"
# GitHub archive directory is celix-<sha>
if [[ ! -d "$CELIX_SRC" ]]; then
  mv "$SRC_ROOT"/celix-* "$CELIX_SRC"
fi

CELIX_BUILD="$PREFIX/build-celix"
rm -rf "$CELIX_BUILD"
mkdir -p "$CELIX_BUILD"

"$CMAKE_BIN" -S "$CELIX_SRC" -B "$CELIX_BUILD" \
  -DCMAKE_INSTALL_PREFIX="$CELIX_PREFIX" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DCMAKE_PREFIX_PATH="$DEPS_PREFIX" \
  -DCMAKE_MODULE_PATH="$CELIX_SRC/cmake/Modules" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_BUILD_RPATH="$DEPS_PREFIX/lib" \
  -DCMAKE_INSTALL_RPATH="\$ORIGIN/../lib;$DEPS_PREFIX/lib" \
  -DENABLE_TESTING=OFF \
  -DENABLE_TESTING_ON_CI=OFF \
  -DFRAMEWORK_CURLINIT=OFF \
  -DCELIX_CXX14=ON \
  -DCELIX_CXX17=ON \
  -DINSTALL_FIND_MODULES=ON \
  -DBUILD_UTILS=ON \
  -DBUILD_FRAMEWORK=ON \
  -DBUILD_RCM=ON \
  -DBUILD_LAUNCHER=OFF \
  -DBUILD_CELIX_DFI=OFF \
  -DBUILD_CELIX_ETCDLIB=OFF \
  -DBUILD_PROMISES=OFF \
  -DBUILD_PUSHSTREAMS=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DBUILD_HTTP_ADMIN=OFF \
  -DBUILD_LOG_SERVICE=OFF \
  -DBUILD_LOG_SERVICE_API=OFF \
  -DBUILD_LOG_HELPER=OFF \
  -DBUILD_SYSLOG_WRITER=OFF \
  -DBUILD_SHELL=OFF \
  -DBUILD_SHELL_API=OFF \
  -DBUILD_SHELL_TUI=OFF \
  -DBUILD_SHELL_WUI=OFF \
  -DBUILD_REMOTE_SHELL=OFF \
  -DBUILD_REMOTE_SERVICE_ADMIN=OFF \
  -DBUILD_CXX_REMOTE_SERVICE_ADMIN=OFF \
  -DBUILD_EVENT_ADMIN=OFF \
  -DBUILD_COMPONENTS_READY_CHECK=OFF \
  -DBUILD_EXPERIMENTAL=OFF

"$CMAKE_BIN" --build "$CELIX_BUILD" --parallel "$JOBS"
"$CMAKE_BIN" --install "$CELIX_BUILD"

echo "$COMMIT" > "$STAMP"
echo "Installed pinned Celix $COMMIT to $CELIX_PREFIX"
