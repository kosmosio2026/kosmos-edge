#!/usr/bin/env bash
set -euo pipefail

cd /home/kosmos/kosmos-edge

export PORT=3000
export API_PORT=3000
export APP_MODE=cloud
export NODE_ENV=production
export DATABASE_URL="postgresql://postgres:postgres@localhost:5434/parking_cloud?schema=public"
export JWT_SECRET="${JWT_SECRET:-dev-secret}"
export JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-7d}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://172.30.1.95:4000,http://localhost:4000}"

pnpm --filter @parking/api build

cd /home/kosmos/kosmos-edge/apps/api
exec node dist/main.js
