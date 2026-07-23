#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
ACTION="${2:---check}"

RESTART_SERVICES="${RESTART_SERVICES_AFTER_UPGRADE:-true}"

POLICY_FILE="${KOSMOS_DEPLOYMENT_POLICY_FILE:-/etc/kosmos-edge/deployment-policy}"
ACTIVE_PROFILE_FILE="${KOSMOS_ACTIVE_PROFILE_FILE:-/etc/kosmos-edge/active-profile}"

usage() {
  cat <<'USAGE'
사용법:
  upgrade-profile.sh <profile> --check
  upgrade-profile.sh <profile> --apply

지원 프로필:
  cloud
  edge
  edge-standalone
  demo
  development

환경 변수:
  RESTART_SERVICES_AFTER_UPGRADE=true|false

정책:
  multi-profile
    지정한 프로필을 업그레이드할 수 있습니다.
    현재 실행 중인 프로필만 재시작합니다.

  single-profile
    /etc/kosmos-edge/active-profile에 기록된
    선택 프로필만 업그레이드할 수 있습니다.
USAGE
}

require_boolean() {
  local name="$1"
  local value="$2"

  case "$value" in
    true|false)
      ;;
    *)
      echo "${name}은 true 또는 false여야 합니다: ${value}" >&2
      exit 1
      ;;
  esac
}

read_trimmed_file() {
  local file="$1"

  if [ -r "$file" ]; then
    tr -d '[:space:]' < "$file"
  else
    echo "not-set"
  fi
}

deployment_policy() {
  local environment_value="${KOSMOS_DEPLOYMENT_POLICY:-}"

  if [ -n "$environment_value" ]; then
    printf '%s\n' "$environment_value"
    return 0
  fi

  if [ -r "$POLICY_FILE" ]; then
    read_trimmed_file "$POLICY_FILE"
  else
    # 기존 개발 서버는 안전하게 다중 프로필로 간주한다.
    echo "multi-profile"
  fi
}

stored_active_profile() {
  read_trimmed_file "$ACTIVE_PROFILE_FILE"
}

if [ -z "$PROFILE" ]; then
  usage >&2
  exit 1
fi

case "$ACTION" in
  --check|--apply)
    ;;
  *)
    echo "지원하지 않는 실행 모드입니다: $ACTION" >&2
    usage >&2
    exit 1
    ;;
esac

require_boolean \
  "RESTART_SERVICES_AFTER_UPGRADE" \
  "$RESTART_SERVICES"

load_profile_env "$PROFILE"

cd "$KOSMOS_ROOT"

POLICY="$(deployment_policy)"
ACTIVE_PROFILE="$(stored_active_profile)"

case "$POLICY" in
  multi-profile)
    ;;
  single-profile)
    if [ "$ACTIVE_PROFILE" = "not-set" ]; then
      echo "UPGRADE BLOCKED" >&2
      echo "단일 프로필 정책이지만 active-profile이 없습니다." >&2
      exit 1
    fi

    if [ "$ACTIVE_PROFILE" != "$PROFILE" ]; then
      echo "UPGRADE BLOCKED" >&2
      echo "선택된 프로필 : $ACTIVE_PROFILE" >&2
      echo "요청한 프로필 : $PROFILE" >&2
      echo "고객 서버에서는 선택된 프로필만 업그레이드할 수 있습니다." >&2
      exit 1
    fi
    ;;
  *)
    echo "UPGRADE BLOCKED" >&2
    echo "알 수 없는 배포 정책입니다: $POLICY" >&2
    exit 1
    ;;
esac

TARGET_UNIT="kosmos-profile@${PROFILE}.target"
DB_UNIT="kosmos-db@${PROFILE}.service"
API_UNIT="kosmos-api@${PROFILE}.service"
WEB_UNIT="kosmos-web@${PROFILE}.service"

echo "========================================"
echo "KOSMOS PROFILE UPGRADE"
echo "========================================"
echo "Profile          : $PROFILE"
echo "Action           : $ACTION"
echo "Deployment policy: $POLICY"
echo "Active profile   : $ACTIVE_PROFILE"
echo "Restart services : $RESTART_SERVICES"
echo

echo "===== PROFILE VALIDATION ====="

bash scripts/validate-profile.sh \
  "$PROFILE"

echo
echo "===== SYSTEMD PREFLIGHT ====="

if [ "$RESTART_SERVICES" = "true" ]; then
  for UNIT in \
    "$TARGET_UNIT" \
    "$DB_UNIT" \
    "$API_UNIT" \
    "$WEB_UNIT"
  do
    if systemd_unit_exists "$UNIT"; then
      echo "FOUND: $UNIT"
    else
      echo "Systemd unit을 찾지 못했습니다: $UNIT" >&2
      exit 1
    fi
  done
else
  echo "서비스 재시작을 요청하지 않아 Systemd 검사를 생략합니다."
fi

echo
echo "===== UPGRADE PLAN ====="
echo "1. Database backup"
echo "2. Database start"
echo "3. Migration and core seed"
echo "4. Database verification"
echo "5. API and Web build"

if [ "$RESTART_SERVICES" = "true" ]; then
  echo "6. Running service restart and runtime verification"
else
  echo "6. Service restart skipped"
fi

if [ "$ACTION" = "--check" ]; then
  echo
  echo "UPGRADE CHECK OK: $PROFILE"
  echo "백업, DB 변경, 빌드, 서비스 재시작은 실행하지 않았습니다."
  exit 0
fi

echo
echo "1/6 Database backup"

scripts/deploy/backup-profile.sh \
  "$PROFILE"

echo
echo "2/6 Database start"

scripts/deploy/db-up.sh \
  "$PROFILE"

echo
echo "3/6 Migration and core seed"

scripts/deploy/db-prepare.sh \
  "$PROFILE"

echo
echo "4/6 Database verification"

INSTALL_SEED_MODE=core-only \
  scripts/deploy/verify-profile.sh \
  "$PROFILE"

echo
echo "5/6 API and Web build"

scripts/deploy/build-profile.sh \
  "$PROFILE"

echo
echo "6/6 Service handling"

if [ "$RESTART_SERVICES" != "true" ]; then
  echo "RESTART_SERVICES_AFTER_UPGRADE=false: 재시작 생략"

  echo
  echo "UPGRADE COMPLETE: $PROFILE"
  exit 0
fi

if systemctl is-active --quiet "$TARGET_UNIT"; then
  echo "RESTART: $API_UNIT"
  sudo systemctl restart "$API_UNIT"

  echo "RESTART: $WEB_UNIT"
  sudo systemctl restart "$WEB_UNIT"
elif [ "$POLICY" = "single-profile" ]; then
  echo "선택된 단일 프로필 target이 비활성 상태이므로 시작합니다."
  sudo systemctl start "$TARGET_UNIT"
else
  echo "현재 실행 중이 아닌 다중 프로필입니다."
  echo "서비스를 새로 시작하지 않습니다."

  echo
  echo "UPGRADE COMPLETE: $PROFILE"
  exit 0
fi

KOSMOS_ENV_FILE="${KOSMOS_ROOT}/apps/api/.env.${PROFILE}" \
  scripts/deploy/verify-runtime.sh \
  "$PROFILE"

echo
echo "UPGRADE COMPLETE: $PROFILE"
