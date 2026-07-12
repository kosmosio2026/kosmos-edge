#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cp packages/db/.env.edge packages/db/.env
cp apps/api/.env.edge apps/api/.env
cp apps/web/.env.edge apps/web/.env.local

echo "Using EDGE env"
grep -n "DATABASE_URL" packages/db/.env apps/api/.env
grep -n "APP_MODE" apps/api/.env || true
grep -n "NEXT_PUBLIC_ENABLE_KAKAO_MAP" apps/web/.env.local || true
