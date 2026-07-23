#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

PROFILE="${1:-}"
load_profile_env "$PROFILE"

cd "$KOSMOS_ROOT"

export PORT="${API_PORT:-${PORT:-3000}}"

if node -e \
  "const p=require('./package.json'); process.exit(p.scripts?.['profile:start'] ? 0 : 1)"
then
  exec pnpm profile:start "$PROFILE" api
fi

if node -e \
  "const p=require('./apps/api/package.json'); process.exit(p.scripts?.['start:prod'] ? 0 : 1)"
then
  exec pnpm --filter @parking/api start:prod
fi

for CANDIDATE in \
  apps/api/dist/main.js \
  apps/api/dist/src/main.js \
  apps/api/dist/apps/api/src/main.js
do
  if [ -f "$CANDIDATE" ]; then
    exec node "$CANDIDATE"
  fi
done

echo "API 실행 파일을 찾지 못했습니다." >&2
exit 1
