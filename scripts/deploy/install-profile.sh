#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"

MODE="${INSTALL_SEED_MODE:-production}"
START_SERVICES="${START_SERVICES_AFTER_INSTALL:-false}"
INSTALL_SYSTEMD="${INSTALL_SYSTEMD_AFTER_INSTALL:-false}"
DEPLOYMENT_POLICY="${INSTALL_DEPLOYMENT_POLICY:-none}"
CONFIRM_SINGLE_PROFILE="${CONFIRM_SINGLE_PROFILE_INSTALL:-false}"

POLICY_FILE="${KOSMOS_DEPLOYMENT_POLICY_FILE:-/etc/kosmos-edge/deployment-policy}"

usage() {
  cat <<'USAGE'
사용법:
  install-profile.sh <profile>

지원 프로필:
  cloud
  edge
  edge-standalone
  demo
  development

주요 환경 변수:
  INSTALL_SEED_MODE=
    production | demo | core-only

  INSTALL_SYSTEMD_AFTER_INSTALL=
    true | false

  START_SERVICES_AFTER_INSTALL=
    true | false

  INSTALL_DEPLOYMENT_POLICY=
    none | single-profile

고객용 단일 프로필 설치 시 필수:
  INSTALL_SYSTEMD_AFTER_INSTALL=true
  START_SERVICES_AFTER_INSTALL=true
  INSTALL_DEPLOYMENT_POLICY=single-profile
  CONFIRM_SINGLE_PROFILE_INSTALL=true
USAGE
}

require_boolean() {
  local name="$1"
  local value="$2"

  case "$value" in
    true|false)
      ;;
    *)
      echo \
        "${name}은 true 또는 false여야 합니다: ${value}" \
        >&2
      exit 1
      ;;
  esac
}

if [ -z "$PROFILE" ]; then
  usage >&2
  exit 1
fi

case "$MODE" in
  production|demo|core-only)
    ;;
  *)
    echo \
      "지원하지 않는 INSTALL_SEED_MODE: ${MODE}" \
      >&2
    exit 1
    ;;
esac

case "$DEPLOYMENT_POLICY" in
  none|single-profile)
    ;;
  *)
    echo \
      "지원하지 않는 INSTALL_DEPLOYMENT_POLICY: " \
      "${DEPLOYMENT_POLICY}" \
      >&2
    exit 1
    ;;
esac

require_boolean \
  "START_SERVICES_AFTER_INSTALL" \
  "$START_SERVICES"

require_boolean \
  "INSTALL_SYSTEMD_AFTER_INSTALL" \
  "$INSTALL_SYSTEMD"

require_boolean \
  "CONFIRM_SINGLE_PROFILE_INSTALL" \
  "$CONFIRM_SINGLE_PROFILE"

if [ "$START_SERVICES" = "true" ]; then
  if [ "$DEPLOYMENT_POLICY" != "single-profile" ]; then
    echo >&2
    echo "INSTALL CONFIGURATION BLOCKED" >&2
    echo >&2
    echo \
      "서비스를 시작하려면 다음 설정이 필요합니다:" \
      >&2
    echo \
      "  INSTALL_DEPLOYMENT_POLICY=single-profile" \
      >&2
    exit 1
  fi

  if [ "$CONFIRM_SINGLE_PROFILE" != "true" ]; then
    echo >&2
    echo "INSTALL CONFIGURATION BLOCKED" >&2
    echo >&2
    echo \
      "단일 프로필 전환을 명시적으로 확인해야 합니다:" \
      >&2
    echo \
      "  CONFIRM_SINGLE_PROFILE_INSTALL=true" \
      >&2
    exit 1
  fi
fi

load_profile_env "$PROFILE"

cd "$KOSMOS_ROOT"

echo "========================================"
echo "KOSMOS PROFILE INSTALL"
echo "========================================"
echo "Profile             : $PROFILE"
echo "Seed mode           : $MODE"
echo "Install Systemd     : $INSTALL_SYSTEMD"
echo "Start services      : $START_SERVICES"
echo "Deployment policy   : $DEPLOYMENT_POLICY"
echo

echo "1/7 Database start"

scripts/deploy/db-up.sh \
  "$PROFILE"

echo
echo "2/7 Migration and core seed"

scripts/deploy/db-prepare.sh \
  "$PROFILE"

echo
echo "3/7 Account bootstrap"

case "$MODE" in
  production)
    pnpm --filter @parking/db \
      seed:bootstrap-account
    ;;

  demo)
    export KOSMOS_TEST_ACCOUNT_PASSWORD="${KOSMOS_TEST_ACCOUNT_PASSWORD:-kosmos1234!}"

    pnpm --filter @parking/db \
      seed:test-accounts
    ;;

  core-only)
    echo "계정 생성을 건너뜁니다."
    ;;
esac

echo
echo "4/7 Database verification"

INSTALL_SEED_MODE="$MODE" \
  scripts/deploy/verify-profile.sh \
  "$PROFILE"

echo
echo "5/7 API and Web build"

scripts/deploy/build-profile.sh \
  "$PROFILE"

echo
echo "6/7 Systemd templates"

scripts/deploy/install-systemd.sh \
  --check

if [ "$INSTALL_SYSTEMD" = "true" ]; then
  scripts/deploy/install-systemd.sh \
    --apply
else
  echo \
    "INSTALL_SYSTEMD_AFTER_INSTALL=false: " \
    "Systemd 설치 생략"
fi

echo
echo "7/7 Service activation"

if [ "$START_SERVICES" != "true" ]; then
  echo \
    "START_SERVICES_AFTER_INSTALL=false: " \
    "서비스 시작 생략"

  echo
  echo "INSTALL COMPLETE: ${PROFILE}"
  exit 0
fi

echo "===== PROFILE ACTIVATION PREFLIGHT ====="

scripts/deploy/select-profile.sh \
  "$PROFILE" \
  --check

POLICY_DIRECTORY="$(dirname "$POLICY_FILE")"
PREVIOUS_POLICY=""
POLICY_FILE_EXISTED=false

if sudo test -f "$POLICY_FILE"; then
  POLICY_FILE_EXISTED=true
  PREVIOUS_POLICY="$(
    sudo cat "$POLICY_FILE"
  )"
fi

sudo install \
  -d \
  -m 0755 \
  "$POLICY_DIRECTORY"

printf '%s\n' "$DEPLOYMENT_POLICY" |
  sudo tee "$POLICY_FILE" \
    >/dev/null

sudo chmod 0644 \
  "$POLICY_FILE"

echo "DEPLOYMENT_POLICY=$DEPLOYMENT_POLICY"

if ! scripts/deploy/select-profile.sh \
  "$PROFILE" \
  --apply
then
  echo \
    "프로필 활성화 실패: 배포 정책을 복원합니다." \
    >&2

  if [ "$POLICY_FILE_EXISTED" = "true" ]; then
    printf '%s\n' "$PREVIOUS_POLICY" |
      sudo tee "$POLICY_FILE" \
        >/dev/null
  else
    sudo rm -f "$POLICY_FILE"
  fi

  exit 1
fi

echo
echo "INSTALL COMPLETE: ${PROFILE}"
