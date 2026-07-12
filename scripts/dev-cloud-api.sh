#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

set -a
source apps/api/.env.cloud
set +a

pnpm --filter @parking/api dev