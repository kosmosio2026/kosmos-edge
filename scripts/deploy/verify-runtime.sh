#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
ACTION="${2:-}"

load_profile_env "$PROFILE"

MANIFEST_FILE="${KOSMOS_PROFILE_MANIFEST:-${KOSMOS_ROOT}/deploy/profiles/${PROFILE}/manifest.env}"

if [ -f "$MANIFEST_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$MANIFEST_FILE"
  set +a

  echo "MANIFEST=$MANIFEST_FILE"
fi

default_api_port() {
  case "$PROFILE" in
    cloud)
      echo 3000
      ;;
    edge)
      echo 3001
      ;;
    edge-standalone)
      echo 3002
      ;;
    demo)
      echo 3003
      ;;
    development)
      echo 3004
      ;;
  esac
}

default_web_port() {
  case "$PROFILE" in
    cloud)
      echo 4000
      ;;
    edge)
      echo 4001
      ;;
    edge-standalone)
      echo 4002
      ;;
    demo)
      echo 4003
      ;;
    development)
      echo 4004
      ;;
  esac
}

find_profile_unit() {
  local target="$1"
  local candidate
  local found

  for candidate in \
    "kosmos-${target}@${PROFILE}.service" \
    "kosmos-${PROFILE}-${target}.service" \
    "kosmos-${target}-${PROFILE}.service"
  do
    if systemd_unit_exists "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  found="$(
    {
      systemctl list-unit-files \
        --type=service \
        --no-pager \
        --no-legend 2>/dev/null

      systemctl list-units \
        --type=service \
        --all \
        --no-pager \
        --no-legend 2>/dev/null
    } |
      awk '{print $1}' |
      sort -u |
      grep -E \
        "^kosmos.*(${target}.*${PROFILE}|${PROFILE}.*${target}).*\.service$" |
      head -n 1 || true
  )"

  if [ -n "$found" ]; then
    printf '%s\n' "$found"
    return 0
  fi

  return 1
}

wait_for_port() {
  local label="$1"
  local port="$2"
  local attempt

  for attempt in $(seq 1 30)
  do
    if ss -lntH |
      grep -qE ":${port}[[:space:]]"
    then
      echo "${label} PORT LISTENING: ${port}"
      return 0
    fi

    sleep 1
  done

  echo "${label} PORT NOT LISTENING: ${port}" >&2
  return 1
}

API_CHECK_PORT="${API_PORT:-$(default_api_port)}"
WEB_CHECK_PORT="${WEB_PORT:-$(default_web_port)}"

API_UNIT="$(find_profile_unit api || true)"
WEB_UNIT="$(find_profile_unit web || true)"

echo
echo "===== RUNTIME PROFILE ====="
echo "Profile  : ${PROFILE}"
echo "API port : ${API_CHECK_PORT}"
echo "Web port : ${WEB_CHECK_PORT}"
echo "API unit : ${API_UNIT:-not-found}"
echo "Web unit : ${WEB_UNIT:-not-found}"

if [ "$ACTION" = "--restart" ]; then
  echo
  echo "===== SERVICE RESTART ====="

  if [ -n "$API_UNIT" ]; then
    sudo systemctl restart "$API_UNIT"
    echo "RESTARTED: $API_UNIT"
  else
    echo "SKIP: API unit not found"
  fi

  if [ -n "$WEB_UNIT" ]; then
    sudo systemctl restart "$WEB_UNIT"
    echo "RESTARTED: $WEB_UNIT"
  else
    echo "SKIP: Web unit not found"
  fi
fi

echo
echo "===== SERVICE STATUS ====="

if [ -n "$API_UNIT" ]; then
  if systemctl is-active --quiet "$API_UNIT"; then
    echo "ACTIVE: $API_UNIT"
  else
    echo "INACTIVE: $API_UNIT" >&2

    sudo journalctl \
      -u "$API_UNIT" \
      -n 100 \
      --no-pager

    exit 1
  fi
fi

if [ -n "$WEB_UNIT" ]; then
  if systemctl is-active --quiet "$WEB_UNIT"; then
    echo "ACTIVE: $WEB_UNIT"
  else
    echo "INACTIVE: $WEB_UNIT" >&2

    sudo journalctl \
      -u "$WEB_UNIT" \
      -n 100 \
      --no-pager

    exit 1
  fi
fi

echo
echo "===== PORT CHECK ====="

wait_for_port API "$API_CHECK_PORT"
wait_for_port WEB "$WEB_CHECK_PORT"

echo
echo "===== API HTTP CHECK ====="

API_HTTP_OK=false

for API_PATH in \
  /api/health \
  /health
do
  if curl \
    --connect-timeout 3 \
    --max-time 10 \
    -fsS \
    -o /dev/null \
    "http://127.0.0.1:${API_CHECK_PORT}${API_PATH}"
  then
    echo "API HTTP OK: ${API_PATH}"
    API_HTTP_OK=true
    break
  fi
done

if [ "$API_HTTP_OK" = false ]; then
  echo "WARN: API health endpoint 없음. API 포트는 정상입니다."
fi

echo
echo "===== WEB HTTP CHECK ====="

WEB_HTTP_OK=false

for WEB_PATH in \
  /manager/login \
  /login \
  /
do
  if curl \
    --connect-timeout 3 \
    --max-time 10 \
    -fsSL \
    -o /dev/null \
    "http://127.0.0.1:${WEB_CHECK_PORT}${WEB_PATH}"
  then
    echo "WEB HTTP OK: ${WEB_PATH}"
    WEB_HTTP_OK=true
    break
  fi
done

if [ "$WEB_HTTP_OK" = false ]; then
  echo "WEB HTTP CHECK FAIL" >&2

  if [ -n "$WEB_UNIT" ]; then
    sudo journalctl \
      -u "$WEB_UNIT" \
      -n 100 \
      --no-pager
  fi

  exit 1
fi

echo
echo "===== LISTENING PORTS ====="

ss -lntH |
  grep -E ":(${API_CHECK_PORT}|${WEB_CHECK_PORT})[[:space:]]" ||
  true

echo
echo "RUNTIME VERIFY OK: ${PROFILE}"
