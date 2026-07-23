#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.."
  pwd
)"

SYSTEMD_SOURCE_DIR="$ROOT_DIR/deploy/systemd"
SYSTEMD_DEST_DIR="/etc/systemd/system"

PROFILE="${1:-}"

if [ -z "$PROFILE" ]; then
  echo \
    "Usage: $0 <profile> [--apply] [--enable] [--start]" \
    >&2
  exit 1
fi

shift

APPLY=false
ENABLE=false
START=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      APPLY=true
      ;;
    --enable)
      ENABLE=true
      ;;
    --start)
      START=true
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac

  shift
done

if {
  [ "$ENABLE" = true ] ||
  [ "$START" = true ]
} && [ "$APPLY" != true ]; then
  echo \
    "ERROR=--enable and --start require --apply" \
    >&2
  exit 1
fi

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
  API_PORT \
  WEB_PORT \
  API_DIST_DIR \
  WEB_DIST_DIR \
  <<< "$PROFILE_CONFIG"

INSTANCE_TARGET="kosmos-profile@${PROFILE}.target"

API_BUILD="$ROOT_DIR/apps/api/$API_DIST_DIR/main.js"
WEB_BUILD="$ROOT_DIR/apps/web/$WEB_DIST_DIR/BUILD_ID"

port_is_in_use() {
  local port="$1"

  ss -ltnH |
    awk -v expected="$port" '
      {
        address = $4
        sub(/^.*:/, "", address)

        if (address == expected) {
          found = 1
        }
      }

      END {
        exit found ? 0 : 1
      }
    '
}

API_PORT_STATE="FREE"
WEB_PORT_STATE="FREE"

if port_is_in_use "$API_PORT"; then
  API_PORT_STATE="IN_USE"
fi

if port_is_in_use "$WEB_PORT"; then
  WEB_PORT_STATE="IN_USE"
fi

API_BUILD_STATE="MISSING"
WEB_BUILD_STATE="MISSING"

if [ -f "$API_BUILD" ]; then
  API_BUILD_STATE="OK"
fi

if [ -f "$WEB_BUILD" ]; then
  WEB_BUILD_STATE="OK"
fi

LEGACY_ACTIVE=()
LEGACY_ENABLED=()

for legacy_unit in \
  "kosmos-${PROFILE}-api.service" \
  "kosmos-${PROFILE}-web.service"
do
  if systemctl is-active \
    --quiet \
    "$legacy_unit" \
    2>/dev/null
  then
    LEGACY_ACTIVE+=("$legacy_unit")
  fi

  if systemctl is-enabled \
    --quiet \
    "$legacy_unit" \
    2>/dev/null
  then
    LEGACY_ENABLED+=("$legacy_unit")
  fi
done

START_READY=true

if [ "$API_BUILD_STATE" != "OK" ]; then
  START_READY=false
fi

if [ "$WEB_BUILD_STATE" != "OK" ]; then
  START_READY=false
fi

if [ "$API_PORT_STATE" != "FREE" ]; then
  START_READY=false
fi

if [ "$WEB_PORT_STATE" != "FREE" ]; then
  START_READY=false
fi

if [ "${#LEGACY_ACTIVE[@]}" -gt 0 ]; then
  START_READY=false
fi

if [ "${#LEGACY_ENABLED[@]}" -gt 0 ]; then
  START_READY=false
fi

echo "PROFILE=$PROFILE"
echo "API_PORT=$API_PORT"
echo "WEB_PORT=$WEB_PORT"
echo "API_DIST_DIR=$API_DIST_DIR"
echo "WEB_DIST_DIR=$WEB_DIST_DIR"
echo "API_BUILD=$API_BUILD"
echo "WEB_BUILD=$WEB_BUILD"
echo "API_BUILD_STATE=$API_BUILD_STATE"
echo "WEB_BUILD_STATE=$WEB_BUILD_STATE"
echo "API_PORT_STATE=$API_PORT_STATE"
echo "WEB_PORT_STATE=$WEB_PORT_STATE"
echo "INSTANCE_TARGET=$INSTANCE_TARGET"

if [ "${#LEGACY_ACTIVE[@]}" -gt 0 ]; then
  printf 'LEGACY_ACTIVE=%s\n' \
    "${LEGACY_ACTIVE[*]}"
else
  echo "LEGACY_ACTIVE=NONE"
fi

if [ "${#LEGACY_ENABLED[@]}" -gt 0 ]; then
  printf 'LEGACY_ENABLED=%s\n' \
    "${LEGACY_ENABLED[*]}"
else
  echo "LEGACY_ENABLED=NONE"
fi

echo "START_READY=$START_READY"

if [ "$APPLY" != true ]; then
  bash \
    "$ROOT_DIR/scripts/deploy/install-systemd.sh" \
    --check

  echo
  echo "SYSTEMD_INSTALL_MODE=DRY_RUN"
  echo \
    "NEXT_COMMAND=$0 $PROFILE --apply"

  if [ "$START_READY" = true ]; then
    echo \
      "READY_COMMAND=$0 $PROFILE --apply --enable --start"
  fi

  exit 0
fi

bash \
  "$ROOT_DIR/scripts/deploy/install-systemd.sh" \
  --apply

echo "SYSTEMD_TEMPLATES_INSTALLED=OK"

if {
  [ "$ENABLE" = true ] ||
  [ "$START" = true ]
} && [ "$START_READY" != true ]; then
  echo \
    "ERROR=PROFILE_NOT_READY_TO_ENABLE_OR_START" \
    >&2
  echo \
    "Templates were installed, but no service was enabled or started." \
    >&2
  exit 2
fi

if [ "$ENABLE" = true ]; then
  sudo systemctl enable "$INSTANCE_TARGET"
  echo "SYSTEMD_PROFILE_ENABLED=$PROFILE"
fi

if [ "$START" = true ]; then
  sudo systemctl start "$INSTANCE_TARGET"

  echo "SYSTEMD_PROFILE_STARTED=$PROFILE"

  systemctl \
    --no-pager \
    --full \
    status "$INSTANCE_TARGET" \
    | sed -n '1,160p'
fi
