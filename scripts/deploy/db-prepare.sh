#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

cd "$KOSMOS_ROOT"

echo "===== MIGRATE DEPLOY: ${PROFILE} ====="

pnpm --filter @parking/db exec \
  prisma migrate deploy \
  --schema=./prisma/schema.prisma

echo
echo "===== CORE SEED: ${PROFILE} ====="

pnpm --filter @parking/db exec \
  tsx prisma/seed-rbac.ts

echo
echo "===== MIGRATION STATUS: ${PROFILE} ====="

pnpm --filter @parking/db exec \
  prisma migrate status \
  --schema=./prisma/schema.prisma

mkdir -p \
  "${KOSMOS_ROOT}/.runtime/deploy"

cat > \
  "${KOSMOS_ROOT}/.runtime/deploy/${PROFILE}.db-ready" <<READY
PROFILE=${PROFILE}
PREPARED_AT=$(date -Iseconds)
DATABASE=${POSTGRES_DB:-unknown}
READY

echo
echo "DATABASE PREPARE OK: ${PROFILE}"
