#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.."
  pwd
)"

PROFILE="${1:-}"
APPLY=false

if [ -z "$PROFILE" ]; then
  echo \
    "Usage: $0 <profile> [--apply]" \
    >&2
  exit 1
fi

shift

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      APPLY=true
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac

  shift
done

INSTANCE_TARGET="kosmos-profile@${PROFILE}.target"

echo "PROFILE=$PROFILE"
echo "INSTANCE_TARGET=$INSTANCE_TARGET"

if [ "$APPLY" != true ]; then
  echo "SYSTEMD_UNINSTALL_MODE=DRY_RUN"
  echo \
    "NEXT_COMMAND=$0 $PROFILE --apply"
  exit 0
fi

sudo systemctl disable \
  --now \
  "$INSTANCE_TARGET" \
  2>/dev/null \
  || true

sudo systemctl daemon-reload
sudo systemctl reset-failed

echo "SYSTEMD_PROFILE_UNINSTALLED=$PROFILE"
echo "SHARED_TEMPLATES_RETAINED=true"
