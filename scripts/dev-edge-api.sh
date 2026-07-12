#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

set -a
source apps/api/.env.edge
set +a

pnpm --filter @parking/api dev