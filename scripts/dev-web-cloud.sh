#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/use-cloud-env.sh
pnpm --filter @parking/web exec next dev -H 0.0.0.0 -p 4000
