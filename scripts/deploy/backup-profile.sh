#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

require_command pg_dump
require_command pg_restore
require_command sha256sum

BACKUP_ROOT="${KOSMOS_BACKUP_ROOT:-${KOSMOS_ROOT}/backups/profile}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${PROFILE}/${STAMP}"
DUMP_FILE="${BACKUP_DIR}/${PROFILE}.dump"
PSQL_URL="$(database_psql_url)"

mkdir -p "$BACKUP_DIR"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE" \
  "$PSQL_URL"

pg_restore \
  --list \
  "$DUMP_FILE" \
  >/dev/null

sha256sum \
  "$DUMP_FILE" \
  > "${DUMP_FILE}.sha256"

echo "BACKUP OK: $DUMP_FILE"
