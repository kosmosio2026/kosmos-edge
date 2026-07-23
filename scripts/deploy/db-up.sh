#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

DB_RUNTIME="${DB_RUNTIME:-external}"
PSQL_URL="$(database_psql_url)"

echo "===== DATABASE START: ${PROFILE} ====="
echo "Runtime: ${DB_RUNTIME}"

case "$DB_RUNTIME" in
  docker)
    require_command docker

    docker compose \
      --project-name "kosmos-${PROFILE}" \
      --env-file "$KOSMOS_ENV_FILE" \
      --file "${KOSMOS_ROOT}/deploy/postgres/compose.yml" \
      up -d postgres
    ;;

  external)
    if [ -n "${POSTGRES_SYSTEMD_UNIT:-}" ]; then
      sudo systemctl start "$POSTGRES_SYSTEMD_UNIT"
    fi
    ;;

  *)
    echo \
      "지원하지 않는 DB_RUNTIME: ${DB_RUNTIME}" \
      >&2
    exit 1
    ;;
esac

echo "PostgreSQL 준비 대기"

for attempt in $(seq 1 60)
do
  if psql \
    "$PSQL_URL" \
    -X \
    -A \
    -t \
    -v ON_ERROR_STOP=1 \
    -c 'SELECT 1;' \
    >/dev/null 2>&1
  then
    echo "DATABASE READY: ${PROFILE}"
    exit 0
  fi

  sleep 2
done

echo \
  "PostgreSQL 연결에 실패했습니다: ${PROFILE}" \
  >&2

exit 1
