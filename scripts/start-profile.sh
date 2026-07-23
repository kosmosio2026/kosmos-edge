#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

PROFILE="${1:-}"
TARGET="${2:-}"
REQUESTED_PORT="${3:-}"

if [ -z "$PROFILE" ] || [ -z "$TARGET" ]; then
  echo \
    "Usage: $0 <profile> <api|web> [port]" \
    >&2
  exit 1
fi

case "$TARGET" in
  api|web)
    ;;
  *)
    echo \
      "Unsupported target: $TARGET" \
      >&2
    exit 1
    ;;
esac

bash \
  "$ROOT_DIR/scripts/validate-profile.sh" \
  "$PROFILE"

PROFILE_CONFIG="$(
  node - "$PROFILE" "$ROOT_DIR" <<'NODE'
const path = require('node:path');

const profile = process.argv[2];
const rootDirectory = process.argv[3];

const {
  getApiPort,
  getWebPort,
  getApiDistDir,
  getWebDistDir,
} = require(
  path.join(
    rootDirectory,
    'scripts/profile-config.cjs',
  ),
);

process.stdout.write(
  [
    getApiPort(profile),
    getWebPort(profile),
    getApiDistDir(profile),
    getWebDistDir(profile),
  ].join('\t'),
);
NODE
)"

IFS=$'\t' read -r \
  DEFAULT_API_PORT \
  DEFAULT_WEB_PORT \
  API_DIST_DIR \
  WEB_DIST_DIR \
  <<< "$PROFILE_CONFIG"

if (
  [ -z "$DEFAULT_API_PORT" ] ||
  [ -z "$DEFAULT_WEB_PORT" ] ||
  [ -z "$API_DIST_DIR" ] ||
  [ -z "$WEB_DIST_DIR" ]
); then
  echo "Unable to resolve profile runtime configuration" >&2
  exit 1
fi

if [ "$TARGET" = "api" ]; then
  PORT_VALUE="${REQUESTED_PORT:-$DEFAULT_API_PORT}"

  ENTRY_FILE="$ROOT_DIR/apps/api/$API_DIST_DIR/main.js"

  if [ ! -f "$ENTRY_FILE" ]; then
    echo \
      "Profile API build not found: $ENTRY_FILE" \
      >&2
    echo \
      "Run: pnpm profile:build $PROFILE api" \
      >&2
    exit 1
  fi

  export KOSMOS_PROFILE_PORT_OVERRIDE="$PORT_VALUE"

  echo "PROFILE=$PROFILE"
  echo "TARGET=api"
  echo "PORT=$PORT_VALUE"
  echo "ENTRY=apps/api/$API_DIST_DIR/main.js"

  exec bash \
    "$ROOT_DIR/scripts/profile-env.sh" \
    "$PROFILE" \
    api \
    --cwd "$ROOT_DIR/apps/api" \
    -- \
    node \
      --enable-source-maps \
      "$API_DIST_DIR/main.js"
fi

PORT_VALUE="${REQUESTED_PORT:-$DEFAULT_WEB_PORT}"

BUILD_DIR="$ROOT_DIR/apps/web/$WEB_DIST_DIR"

if [ ! -f "$BUILD_DIR/BUILD_ID" ]; then
  echo \
    "Profile Web build not found: $BUILD_DIR" \
    >&2
  echo \
    "Run: pnpm profile:build $PROFILE web" \
    >&2
  exit 1
fi

export KOSMOS_PROFILE_PORT_OVERRIDE="$PORT_VALUE"

echo "PROFILE=$PROFILE"
echo "TARGET=web"
echo "PORT=$PORT_VALUE"
echo "BUILD=apps/web/$WEB_DIST_DIR"

exec bash \
  "$ROOT_DIR/scripts/profile-env.sh" \
  "$PROFILE" \
  web \
  --cwd "$ROOT_DIR" \
  -- \
  pnpm \
    --filter @parking/web \
    exec next start \
    -p "$PORT_VALUE"
