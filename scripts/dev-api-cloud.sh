#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/use-cloud-env.sh
pnpm --filter @parking/api dev
