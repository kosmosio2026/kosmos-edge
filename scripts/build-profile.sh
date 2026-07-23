#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

PROFILE="${1:-}"
TARGET="${2:-all}"

if [ -z "$PROFILE" ]; then
  echo \
    "Usage: $0 <profile> [api|web|all]" \
    >&2
  exit 1
fi

case "$TARGET" in
  api|web|all)
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

PROFILE_PATHS="$(
  node - "$PROFILE" "$ROOT_DIR" <<'NODE'
const path = require('node:path');

const profile = process.argv[2];
const rootDirectory = process.argv[3];

const {
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
    getApiDistDir(profile),
    getWebDistDir(profile),
  ].join('\t'),
);
NODE
)"

IFS=$'\t' read -r \
  API_DIST_DIR \
  WEB_DIST_DIR \
  <<< "$PROFILE_PATHS"

if [ -z "$API_DIST_DIR" ] || [ -z "$WEB_DIST_DIR" ]; then
  echo "Unable to resolve profile build paths" >&2
  exit 1
fi


build_api() {
  echo
  echo "===== Build API: $PROFILE ====="

  local source_dir="$ROOT_DIR/apps/api/dist"
  local target_dir="$ROOT_DIR/apps/api/$API_DIST_DIR"
  local staging_dir
  local backup_root
  local source_backup
  local had_source=false
  local build_status

  staging_dir="$ROOT_DIR/apps/api/.${API_DIST_DIR}.staging.$$"
  backup_root="$(mktemp -d)"
  source_backup="$backup_root/dist"

  if [ "$source_dir" = "$target_dir" ]; then
    echo \
      "API source and target directories must differ: $source_dir" \
      >&2
    rm -rf "$backup_root"
    return 1
  fi

  if [ -d "$source_dir" ]; then
    cp -a \
      "$source_dir" \
      "$source_backup"

    had_source=true
  fi

  rm -rf "$staging_dir"

  set +e

  (
    set -e

    bash \
      "$ROOT_DIR/scripts/profile-env.sh" \
      "$PROFILE" \
      api \
      --cwd "$ROOT_DIR" \
      -- \
      pnpm --filter @parking/api build

    if [ ! -f "$source_dir/main.js" ]; then
      echo \
        "API build entry not found: $source_dir/main.js" \
        >&2
      exit 1
    fi

    mkdir -p "$staging_dir"

    cp -a \
      "$source_dir/." \
      "$staging_dir/"

    node - \
      "$PROFILE" \
      "$ROOT_DIR/VERSION" \
      "$staging_dir/BUILD_INFO.json" \
      <<'NODE'
const fs = require('node:fs');

const profile = process.argv[2];
const versionFile = process.argv[3];
const outputFile = process.argv[4];

const version = fs
  .readFileSync(versionFile, 'utf8')
  .trim()
  .replace(/^v/i, '');

fs.writeFileSync(
  outputFile,
  JSON.stringify(
    {
      profile,
      version,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);
NODE
  )

  build_status=$?

  set -e

  # Restore the shared legacy dist directory because the existing
  # Cloud and connected Edge systemd units still execute dist/main.js.
  rm -rf "$source_dir"

  if [ "$had_source" = true ]; then
    mv \
      "$source_backup" \
      "$source_dir"
  fi

  rm -rf "$backup_root"

  if [ "$build_status" -ne 0 ]; then
    rm -rf "$staging_dir"

    echo \
      "API build failed. The shared dist directory was restored." \
      >&2

    return "$build_status"
  fi

  rm -rf "$target_dir"

  mv \
    "$staging_dir" \
    "$target_dir"

  echo "API_OUTPUT=apps/api/$API_DIST_DIR"
  echo "API_SHARED_DIST_RESTORED=true"
}

build_web() {
  echo
  echo "===== Build Web: $PROFILE ====="

  local tsconfig_path="$ROOT_DIR/apps/web/tsconfig.json"
  local output_dir="$ROOT_DIR/apps/web/$WEB_DIST_DIR"
  local tsconfig_backup
  local build_status

  tsconfig_backup="$(mktemp)"
  cp "$tsconfig_path" "$tsconfig_backup"

  echo "Cleaning previous Web output: apps/web/$WEB_DIST_DIR"
  rm -rf "$output_dir"

  set +e

  bash \
    "$ROOT_DIR/scripts/profile-env.sh" \
    "$PROFILE" \
    web \
    --cwd "$ROOT_DIR" \
    -- \
    pnpm --filter @parking/web build

  build_status=$?

  set -e

  cp "$tsconfig_backup" "$tsconfig_path"
  rm -f "$tsconfig_backup"

  if [ "$build_status" -ne 0 ]; then
    echo \
      "Web build failed. tsconfig.json was restored." \
      >&2
    return "$build_status"
  fi

  echo "WEB_OUTPUT=apps/web/$WEB_DIST_DIR"
}

case "$TARGET" in
  api)
    build_api
    ;;
  web)
    build_web
    ;;
  all)
    build_api
    build_web
    ;;
esac

echo
echo "PROFILE_BUILD=OK"
echo "PROFILE=$PROFILE"
echo "TARGET=$TARGET"
