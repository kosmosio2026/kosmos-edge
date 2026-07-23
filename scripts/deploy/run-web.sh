#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

cd "$KOSMOS_ROOT"

export PORT="${WEB_PORT:-4000}"

if node -e \
  "const p=require('./package.json'); process.exit(p.scripts?.['profile:start'] ? 0 : 1)"
then
  exec pnpm profile:start "$PROFILE" web
fi

exec pnpm \
  --filter @parking/web \
  start \
  -- \
  -p "$PORT"
