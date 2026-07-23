#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

READY_FILE="${KOSMOS_ROOT}/.runtime/deploy/${PROFILE}.db-ready"

if [ ! -f "$READY_FILE" ]; then
  echo \
    "DB 준비 기록이 없습니다: ${READY_FILE}" \
    >&2

  echo \
    "먼저 db-up.sh와 db-prepare.sh를 실행하세요." \
    >&2

  exit 1
fi

cd "$KOSMOS_ROOT"

echo "===== API BUILD: ${PROFILE} ====="

pnpm profile:build "$PROFILE" api

echo
echo "===== WEB BUILD: ${PROFILE} ====="

pnpm profile:build "$PROFILE" web

echo
echo "BUILD OK: ${PROFILE}"
