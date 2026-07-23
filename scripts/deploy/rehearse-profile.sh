#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

LOG_DIR="${KOSMOS_ROOT}/build/deployment-rehearsal"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/${PROFILE}-${STAMP}.log"

mkdir -p "$LOG_DIR"

exec > >(tee "$LOG_FILE") 2>&1

cd "$KOSMOS_ROOT"

echo "========================================"
echo "KOSMOS PROFILE INSTALLATION REHEARSAL"
echo "========================================"
echo "Profile : ${PROFILE}"
echo "Started : $(date -Iseconds)"
echo "Log     : ${LOG_FILE}"
echo

echo "===== 1. DEPLOYMENT SCRIPT SYNTAX ====="

for FILE in scripts/deploy/*.sh
do
  echo "CHECK $FILE"
  bash -n "$FILE"
done

echo "SCRIPT SYNTAX OK"
echo

echo "===== 2. DATABASE SEED TYPECHECK ====="

pnpm --filter @parking/db \
  typecheck:scripts

echo "DATABASE SEED TYPECHECK OK"
echo

echo "===== 3. DATABASE START ====="

scripts/deploy/db-up.sh "$PROFILE"

echo
echo "===== 4. DATABASE BACKUP ====="

scripts/deploy/backup-profile.sh "$PROFILE"

echo
echo "===== 5. MIGRATION AND CORE SEED ====="

scripts/deploy/db-prepare.sh "$PROFILE"

echo
echo "===== 6. EMPTY OPERATIONAL DATA CHECK ====="

PSQL_URL="$(database_psql_url)"

OPERATIONAL_COUNT="$(
  psql \
    "$PSQL_URL" \
    -X \
    -A \
    -t \
    -v ON_ERROR_STOP=1 <<'SQL'
SELECT
    (SELECT count(*) FROM "ParkingLot")
  + (SELECT count(*) FROM "ParkingSection")
  + (SELECT count(*) FROM "ParkingSpace")
  + (SELECT count(*) FROM "ParkingSession")
  + (SELECT count(*) FROM "Invoice")
  + (SELECT count(*) FROM "Payment")
  + (SELECT count(*) FROM "PaymentTransaction")
  + (SELECT count(*) FROM "SensorDevice")
  + (SELECT count(*) FROM "DisplayBoard");
SQL
)"

OPERATIONAL_COUNT="$(
  printf '%s' "$OPERATIONAL_COUNT" |
    tr -d '[:space:]'
)"

echo "Operational rows: ${OPERATIONAL_COUNT}"

if [ "$OPERATIONAL_COUNT" -ne 0 ]; then
  echo
  echo "업무 데이터가 비어 있지 않습니다."
  echo "리허설을 중단합니다."
  echo
  echo "현재 DB는 리허설용 빈 DB가 아닙니다."
  echo "전체 DB 삭제 도구는 안전상 배포 패키지에 포함하지 않습니다."
  echo "별도의 빈 리허설 DB 또는 새 프로필 DB를 준비한 뒤 다시 실행하세요."
  exit 1
fi

echo "EMPTY OPERATIONAL DATA OK"
echo

echo "===== 7. DEMO TEST ACCOUNT SEED ====="

export INSTALL_SEED_MODE=demo
export KOSMOS_TEST_ACCOUNT_PASSWORD='kosmos1234!'

pnpm --filter @parking/db \
  seed:test-accounts

echo
echo "===== 8. DATABASE VERIFICATION ====="

scripts/deploy/verify-profile.sh "$PROFILE"

echo
echo "===== 9. PROFILE BUILD ====="

scripts/deploy/build-profile.sh "$PROFILE"

echo
echo "===== 10-11. SERVICE AND HTTP CHECK ====="

scripts/deploy/verify-runtime.sh \
  "$PROFILE" \
  --restart

echo
echo "===== 12. FINAL DATABASE SUMMARY ====="

psql \
  "$PSQL_URL" \
  -X \
  -v ON_ERROR_STOP=1 <<'SQL'
\pset pager off

SELECT
  'Role' AS table_name,
  count(*) AS row_count
FROM "Role"

UNION ALL

SELECT
  'Permission',
  count(*)
FROM "Permission"

UNION ALL

SELECT
  'RolePermission',
  count(*)
FROM "RolePermission"

UNION ALL

SELECT
  'Tenant',
  count(*)
FROM "Tenant"

UNION ALL

SELECT
  'User',
  count(*)
FROM "User"

UNION ALL

SELECT
  'ParkingLot',
  count(*)
FROM "ParkingLot"

UNION ALL

SELECT
  'ParkingSession',
  count(*)
FROM "ParkingSession"

ORDER BY table_name;

SELECT
  u."email",
  u."name",
  string_agg(
    r."code",
    ',' ORDER BY r."code"
  ) AS roles
FROM "User" u
JOIN "UserRole" ur
  ON ur."userId" = u."id"
JOIN "Role" r
  ON r."id" = ur."roleId"
GROUP BY
  u."id",
  u."email",
  u."name"
ORDER BY u."email";
SQL

echo
echo "========================================"
echo "PROFILE REHEARSAL COMPLETE"
echo "========================================"
echo "Profile  : ${PROFILE}"
echo "Finished : $(date -Iseconds)"
echo "Log      : ${LOG_FILE}"
echo
echo "Test accounts:"
echo "  admin@kosmos.test"
echo "  manager@kosmos.test"
echo "  operator@kosmos.test"
echo "  member@kosmos.test"
echo
echo "Initial password:"
echo "  kosmos1234!"
