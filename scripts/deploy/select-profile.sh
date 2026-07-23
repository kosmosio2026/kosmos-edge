#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

SUPPORTED_PROFILES=(
  cloud
  edge
  edge-standalone
  demo
  development
)

ACTIVE_PROFILE_FILE="${KOSMOS_ACTIVE_PROFILE_FILE:-/etc/kosmos-edge/active-profile}"
DEPLOYMENT_POLICY_FILE="${KOSMOS_DEPLOYMENT_POLICY_FILE:-/etc/kosmos-edge/deployment-policy}"

usage() {
  cat <<'USAGE'
사용법:
  select-profile.sh --status
  select-profile.sh <profile> --check
  select-profile.sh <profile> --apply

지원 프로필:
  cloud
  edge
  edge-standalone
  demo
  development

동작:
  --status  현재 활성화/실행 상태 조회
  --check   전환 가능 여부와 예정 작업만 확인
  --apply   선택 프로필만 활성화하고 나머지는 중지/비활성화
USAGE
}

is_supported_profile() {
  local requested="${1:-}"
  local item

  for item in "${SUPPORTED_PROFILES[@]}"
  do
    if [ "$item" = "$requested" ]; then
      return 0
    fi
  done

  return 1
}

unit_active_state() {
  systemctl is-active "$1" 2>/dev/null || true
}

unit_enabled_state() {
  systemctl is-enabled "$1" 2>/dev/null || true
}

manifest_value() {
  local manifest="$1"
  local key="$2"

  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "")
      print
      exit
    }
  ' "$manifest"
}

deployment_policy() {
  local value="${KOSMOS_DEPLOYMENT_POLICY:-}"

  if [ -n "$value" ]; then
    printf '%s\n' "$value"
    return 0
  fi

  if [ -r "$DEPLOYMENT_POLICY_FILE" ]; then
    tr -d '[:space:]' < "$DEPLOYMENT_POLICY_FILE"
  else
    # 정책 파일이 없는 기존 개발 서버는 안전하게
    # 다중 프로필 모드로 간주한다.
    echo "multi-profile"
  fi
}

stored_active_profile() {
  if [ -r "$ACTIVE_PROFILE_FILE" ]; then
    tr -d '[:space:]' < "$ACTIVE_PROFILE_FILE"
  else
    echo "not-set"
  fi
}

show_profile_status() {
  local profile
  local target_unit
  local db_unit
  local api_unit
  local web_unit

  echo "===== DEPLOYMENT POLICY ====="
  echo "$(deployment_policy)"
  echo
  echo "===== STORED ACTIVE PROFILE ====="
  echo "$(stored_active_profile)"
  echo
  echo "===== PROFILE TARGETS ====="

  for profile in "${SUPPORTED_PROFILES[@]}"
  do
    target_unit="kosmos-profile@${profile}.target"

    printf '%-48s active=%-12s enabled=%s\n' \
      "$target_unit" \
      "$(unit_active_state "$target_unit")" \
      "$(unit_enabled_state "$target_unit")"
  done

  echo
  echo "===== PROFILE SERVICES ====="

  for profile in "${SUPPORTED_PROFILES[@]}"
  do
    db_unit="kosmos-db@${profile}.service"
    api_unit="kosmos-api@${profile}.service"
    web_unit="kosmos-web@${profile}.service"

    printf '%-48s active=%-12s enabled=%s\n' \
      "$db_unit" \
      "$(unit_active_state "$db_unit")" \
      "$(unit_enabled_state "$db_unit")"

    printf '%-48s active=%-12s enabled=%s\n' \
      "$api_unit" \
      "$(unit_active_state "$api_unit")" \
      "$(unit_enabled_state "$api_unit")"

    printf '%-48s active=%-12s enabled=%s\n' \
      "$web_unit" \
      "$(unit_active_state "$web_unit")" \
      "$(unit_enabled_state "$web_unit")"
  done
}

validate_selected_profile() {
  local profile="$1"
  local manifest
  local api_dist
  local web_dist
  local api_entry
  local web_build
  local unit

  manifest="${KOSMOS_ROOT}/deploy/profiles/${profile}/manifest.env"

  if [ ! -f "$manifest" ]; then
    echo "프로필 manifest가 없습니다: $manifest" >&2
    return 1
  fi

  echo "===== PROFILE VALIDATION ====="

  bash \
    "${KOSMOS_ROOT}/scripts/validate-profile.sh" \
    "$profile"

  api_dist="$(manifest_value "$manifest" API_DIST_DIR)"
  web_dist="$(manifest_value "$manifest" WEB_DIST_DIR)"

  if [ -z "$api_dist" ] || [ -z "$web_dist" ]; then
    echo "manifest의 build 경로가 누락됐습니다." >&2
    return 1
  fi

  api_entry="${KOSMOS_ROOT}/apps/api/${api_dist}/main.js"
  web_build="${KOSMOS_ROOT}/apps/web/${web_dist}/BUILD_ID"

  echo
  echo "===== BUILD ARTIFACTS ====="
  echo "API entry : $api_entry"
  echo "Web build : $web_build"

  if [ ! -f "$api_entry" ]; then
    echo "API build가 없습니다: $api_entry" >&2
    return 1
  fi

  if [ ! -f "$web_build" ]; then
    echo "Web build가 없습니다: $web_build" >&2
    return 1
  fi

  echo "API BUILD FOUND"
  echo "WEB BUILD FOUND"

  echo
  echo "===== SYSTEMD UNITS ====="

  for unit in \
    "kosmos-profile@${profile}.target" \
    "kosmos-db@${profile}.service" \
    "kosmos-api@${profile}.service" \
    "kosmos-web@${profile}.service"
  do
    if systemd_unit_exists "$unit"; then
      echo "FOUND: $unit"
    else
      echo "Systemd unit을 찾지 못했습니다: $unit" >&2
      return 1
    fi
  done
}

show_plan() {
  local selected="$1"
  local profile

  echo
  echo "===== PROFILE SWITCH PLAN ====="
  echo "Deployment policy: $(deployment_policy)"
  echo "Selected profile  : $selected"
  echo

  for profile in "${SUPPORTED_PROFILES[@]}"
  do
    if [ "$profile" = "$selected" ]; then
      echo "ENABLE AND START:"
      echo "  kosmos-profile@${profile}.target"
    else
      echo "STOP AND DISABLE:"
      echo "  kosmos-profile@${profile}.target"
      echo "  kosmos-db@${profile}.service"
      echo "  kosmos-api@${profile}.service"
      echo "  kosmos-web@${profile}.service"
    fi
  done

  echo
  echo "ACTIVE PROFILE FILE:"
  echo "  ${ACTIVE_PROFILE_FILE}"
}

stop_and_disable_profile() {
  local profile="$1"
  local target_unit="kosmos-profile@${profile}.target"
  local db_unit="kosmos-db@${profile}.service"
  local api_unit="kosmos-api@${profile}.service"
  local web_unit="kosmos-web@${profile}.service"

  echo "STOP PROFILE: $profile"

  sudo systemctl stop "$target_unit" 2>/dev/null || true

  sudo systemctl stop \
    "$web_unit" \
    "$api_unit" \
    "$db_unit" \
    2>/dev/null || true

  sudo systemctl disable \
    "$target_unit" \
    "$db_unit" \
    "$api_unit" \
    "$web_unit" \
    >/dev/null 2>&1 || true
}

activate_selected_profile() {
  local profile="$1"
  local target_unit="kosmos-profile@${profile}.target"
  local db_unit="kosmos-db@${profile}.service"
  local api_unit="kosmos-api@${profile}.service"
  local web_unit="kosmos-web@${profile}.service"

  # 하위 unit은 target을 통해 시작한다.
  sudo systemctl disable \
    "$db_unit" \
    "$api_unit" \
    "$web_unit" \
    >/dev/null 2>&1 || true

  sudo systemctl reset-failed \
    "$target_unit" \
    "$db_unit" \
    "$api_unit" \
    "$web_unit"

  sudo systemctl enable "$target_unit"
  sudo systemctl start "$target_unit"

  sudo install \
    -d \
    -m 0755 \
    "$(dirname "$ACTIVE_PROFILE_FILE")"

  printf '%s\n' "$profile" |
    sudo tee "$ACTIVE_PROFILE_FILE" \
      >/dev/null

  sudo chmod 0644 "$ACTIVE_PROFILE_FILE"
}

if [ "${1:-}" = "--status" ]; then
  show_profile_status
  exit 0
fi

PROFILE="${1:-}"
MODE="${2:---check}"

if [ -z "$PROFILE" ]; then
  usage >&2
  exit 1
fi

if ! is_supported_profile "$PROFILE"; then
  echo "지원하지 않는 프로필입니다: $PROFILE" >&2
  usage >&2
  exit 1
fi

case "$MODE" in
  --check|--apply)
    ;;
  *)
    echo "지원하지 않는 실행 모드입니다: $MODE" >&2
    usage >&2
    exit 1
    ;;
esac

validate_selected_profile "$PROFILE"
show_plan "$PROFILE"

POLICY="$(deployment_policy)"

if [ "$MODE" = "--check" ]; then
  echo
  echo "PROFILE SWITCH CHECK OK: $PROFILE"
  echo "현재 Systemd 상태는 변경하지 않았습니다."

  if [ "$POLICY" != "single-profile" ]; then
    echo "현재 정책에서는 --apply가 차단됩니다: $POLICY"
  fi

  exit 0
fi

if [ "$POLICY" != "single-profile" ]; then
  echo >&2
  echo "PROFILE SWITCH BLOCKED" >&2
  echo "현재 배포 정책: $POLICY" >&2
  echo >&2
  echo "다중 프로필 개발 서버에서는 다른 프로필을" >&2
  echo "중지하는 --apply 작업을 실행할 수 없습니다." >&2
  echo >&2
  echo "고객용 단일 프로필 설치에서만 다음 정책을 사용합니다:" >&2
  echo "  single-profile" >&2
  exit 1
fi

echo
echo "===== APPLY PROFILE SWITCH ====="

for item in "${SUPPORTED_PROFILES[@]}"
do
  if [ "$item" != "$PROFILE" ]; then
    stop_and_disable_profile "$item"
  fi
done

activate_selected_profile "$PROFILE"

echo
echo "===== RUNTIME VERIFICATION ====="

KOSMOS_ENV_FILE="${KOSMOS_ROOT}/apps/api/.env.${PROFILE}" \
  "${KOSMOS_ROOT}/scripts/deploy/verify-runtime.sh" \
  "$PROFILE"

echo
echo "===== FINAL STATUS ====="

show_profile_status

echo
echo "PROFILE SWITCH COMPLETE: $PROFILE"
