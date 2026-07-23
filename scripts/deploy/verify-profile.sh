#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

PSQL_URL="$(database_psql_url)"
MODE="${INSTALL_SEED_MODE:-core-only}"

RESULT="$(
  psql \
    "$PSQL_URL" \
    -X \
    -A \
    -t \
    -F '|' \
    -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM "_prisma_migrations"),
  (SELECT count(*) FROM "Role"),
  (SELECT count(*) FROM "Permission"),
  (SELECT count(*) FROM "RolePermission"),
  (SELECT count(*) FROM "Tenant"),
  (SELECT count(*) FROM "User"),
  (SELECT count(*) FROM "ParkingLot"),
  (SELECT count(*) FROM "ParkingSession"),
  (SELECT count(*) FROM "Invoice"),
  (SELECT count(*) FROM "Payment");

SELECT COALESCE(
  string_agg("email", ',' ORDER BY "email"),
  ''
)
FROM "User";
SQL
)"

COUNTS="$(printf '%s\n' "$RESULT" | sed -n '1p')"
EMAILS="$(printf '%s\n' "$RESULT" | sed -n '2p')"

IFS='|' read -r \
  MIGRATIONS \
  ROLES \
  PERMISSIONS \
  ROLE_PERMISSIONS \
  TENANTS \
  USERS \
  PARKING_LOTS \
  PARKING_SESSIONS \
  INVOICES \
  PAYMENTS \
  <<< "$COUNTS"

FAILED=0

check_positive() {
  local label="$1"
  local value="$2"

  if [ "$value" -le 0 ]; then
    echo "FAIL: ${label}=${value}"
    FAILED=1
  fi
}

check_positive "migrations" "$MIGRATIONS"
check_positive "roles" "$ROLES"
check_positive "permissions" "$PERMISSIONS"
check_positive "rolePermissions" "$ROLE_PERMISSIONS"

case "$MODE" in
  production)
    if [ "$USERS" -lt 1 ]; then
      echo "FAIL: production bootstrap user 없음"
      FAILED=1
    fi
    ;;

  demo)
    if [ "$USERS" -ne 4 ]; then
      echo "FAIL: demo user count=${USERS}, expected=4"
      FAILED=1
    fi
    ;;

  core-only)
    ;;

  *)
    echo "FAIL: 알 수 없는 INSTALL_SEED_MODE=${MODE}"
    FAILED=1
    ;;
esac

echo
echo "===== VERIFY: ${PROFILE} ====="
echo "Mode             : ${MODE}"
echo "Migrations       : ${MIGRATIONS}"
echo "Roles            : ${ROLES}"
echo "Permissions      : ${PERMISSIONS}"
echo "RolePermissions  : ${ROLE_PERMISSIONS}"
echo "Tenants          : ${TENANTS}"
echo "Users            : ${USERS}"
echo "ParkingLots      : ${PARKING_LOTS}"
echo "ParkingSessions  : ${PARKING_SESSIONS}"
echo "Invoices         : ${INVOICES}"
echo "Payments         : ${PAYMENTS}"
echo "Emails           : ${EMAILS}"

if [ "$FAILED" -ne 0 ]; then
  echo "VERIFY FAIL: ${PROFILE}" >&2
  exit 1
fi

echo "VERIFY OK: ${PROFILE}"
