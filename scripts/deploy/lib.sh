#!/usr/bin/env bash
set -euo pipefail

DEPLOY_SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")"
  pwd
)"

KOSMOS_ROOT="${KOSMOS_ROOT:-$(
  cd "${DEPLOY_SCRIPT_DIR}/../.."
  pwd
)}"

require_profile() {
  local profile="${1:-}"

  case "$profile" in
    cloud|edge|edge-standalone|demo|development)
      ;;
    *)
      echo \
        "지원 프로필: cloud, edge, edge-standalone, demo, development" \
        >&2
      return 1
      ;;
  esac
}

resolve_profile_env() {
  local profile="$1"
  local requested="${KOSMOS_ENV_FILE:-}"
  local system_file="/etc/kosmos-edge/${profile}.env"
  local project_file="${KOSMOS_ROOT}/apps/api/.env.${profile}"

  if [ -n "$requested" ]; then
    printf '%s\n' "$requested"
    return
  fi

  if [ -f "$system_file" ]; then
    printf '%s\n' "$system_file"
    return
  fi

  if [ -f "$project_file" ]; then
    printf '%s\n' "$project_file"
    return
  fi

  echo \
    "프로필 환경 파일을 찾을 수 없습니다: ${profile}" \
    >&2

  return 1
}

load_profile_env() {
  local profile="$1"
  local env_file

  require_profile "$profile"
  env_file="$(resolve_profile_env "$profile")"

  if [ ! -f "$env_file" ]; then
    echo "환경 파일이 없습니다: $env_file" >&2
    return 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  export APP_PROFILE="${APP_PROFILE:-$profile}"
  export KOSMOS_ENV_FILE="$env_file"
  export KOSMOS_ROOT

  if [ -z "${DATABASE_URL:-}" ]; then
    echo \
      "DATABASE_URL이 설정되지 않았습니다: $env_file" \
      >&2
    return 1
  fi
}

database_psql_url() {
  printf '%s\n' "${DATABASE_URL%%\?*}"
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1
  then
    echo \
      "필수 명령을 찾을 수 없습니다: $command_name" \
      >&2
    return 1
  fi
}

systemd_unit_exists() {
  local unit="$1"

  systemctl cat "$unit" >/dev/null 2>&1
}

# BEGIN KOSMOS ROBUST SYSTEMD UNIT CHECK
# Template instances such as kosmos-api@edge.service are resolved through
# systemd rather than by checking for an exact unit filename.
systemd_unit_exists() {
  local unit="${1:-}"
  local load_state

  if [ -z "$unit" ]; then
    return 1
  fi

  load_state="$(
    systemctl show \
      "$unit" \
      --property=LoadState \
      --value \
      2>/dev/null || true
  )"

  case "$load_state" in
    loaded|masked|generated|transient)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
# END KOSMOS ROBUST SYSTEMD UNIT CHECK
