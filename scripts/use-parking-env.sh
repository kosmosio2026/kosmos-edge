#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cp packages/db/.env.parking packages/db/.env
cp apps/api/.env.parking apps/api/.env
cp apps/web/.env.parking apps/web/.env.local

echo "Using PARKING env"
grep -n "DATABASE_URL" packages/db/.env apps/api/.env
grep -n "NEXT_PUBLIC_ENABLE_KAKAO_MAP" apps/web/.env.local || true
