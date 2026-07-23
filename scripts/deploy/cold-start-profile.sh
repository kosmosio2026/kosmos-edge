#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

TARGET_UNIT="kosmos-profile@${PROFILE}.target"
DB_UNIT="kosmos-db@${PROFILE}.service"
API_UNIT="kosmos-api@${PROFILE}.service"
WEB_UNIT="kosmos-web@${PROFILE}.service"

for UNIT in \
  "$TARGET_UNIT" \
  "$DB_UNIT" \
  "$API_UNIT" \
  "$WEB_UNIT"
do
  if ! systemd_unit_exists "$UNIT"; then
    echo "Systemd unit을 찾지 못했습니다: $UNIT" >&2
    exit 1
  fi
done

wait_active() {
  local unit="$1"
  local timeout="${2:-120}"
  local elapsed=0

  while [ "$elapsed" -lt "$timeout" ]
  do
    if systemctl is-active --quiet "$unit"; then
      echo "ACTIVE: $unit"
      return 0
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "START TIMEOUT: $unit" >&2

  sudo systemctl status \
    "$unit" \
    --no-pager \
    -l || true

  return 1
}

echo "========================================"
echo "KOSMOS COLD START TEST"
echo "========================================"
echo "Profile: $PROFILE"
echo

echo "===== 1. COMPLETE STOP ====="

sudo systemctl stop "$TARGET_UNIT" 2>/dev/null || true

sudo systemctl stop \
  "$WEB_UNIT" \
  "$API_UNIT" \
  "$DB_UNIT"

for UNIT in \
  "$TARGET_UNIT" \
  "$DB_UNIT" \
  "$API_UNIT" \
  "$WEB_UNIT"
do
  if systemctl is-active --quiet "$UNIT"; then
    echo "STOP FAIL: $UNIT" >&2
    exit 1
  fi

  echo "STOPPED: $UNIT"
done

sudo systemctl reset-failed \
  "$TARGET_UNIT" \
  "$DB_UNIT" \
  "$API_UNIT" \
  "$WEB_UNIT"

echo
echo "===== 2. TARGET-ONLY START ====="

START_TIME="$(date -Iseconds)"

sudo systemctl start "$TARGET_UNIT"

echo
echo "===== 3. DEPENDENCY WAIT ====="

wait_active "$DB_UNIT" 180
wait_active "$API_UNIT" 120
wait_active "$WEB_UNIT" 120
wait_active "$TARGET_UNIT" 120

echo
echo "===== 4. RUNTIME VERIFICATION ====="

scripts/deploy/verify-runtime.sh "$PROFILE"

echo
echo "===== 5. ENABLEMENT ====="

sudo systemctl enable "$TARGET_UNIT"

# 하위 unit은 target에서 시작하므로 개별 enable하지 않는다.
sudo systemctl disable \
  "$DB_UNIT" \
  "$API_UNIT" \
  "$WEB_UNIT" \
  >/dev/null 2>&1 || true

printf '%-52s %s\n' \
  "$TARGET_UNIT" \
  "$(systemctl is-enabled "$TARGET_UNIT" 2>/dev/null || true)"

for UNIT in \
  "$DB_UNIT" \
  "$API_UNIT" \
  "$WEB_UNIT"
do
  printf '%-52s %s\n' \
    "$UNIT" \
    "$(systemctl is-enabled "$UNIT" 2>/dev/null || true)"
done

echo
echo "===== 6. COLD START LOG ====="

sudo journalctl \
  -u "$DB_UNIT" \
  -u "$API_UNIT" \
  -u "$WEB_UNIT" \
  --since "$START_TIME" \
  --no-pager \
  -o short-iso

echo
echo "========================================"
echo "COLD START TEST COMPLETE"
echo "========================================"
echo "Profile: $PROFILE"
