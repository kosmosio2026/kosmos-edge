#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/use-edge-env.sh

sudo docker exec -i kosmos-edge-postgres psql -U postgres <<'SQL'
select 'create database parking_edge'
where not exists (
  select from pg_database where datname = 'parking_edge'
)\gexec
SQL

pnpm --filter @parking/db db:push
pnpm --filter @parking/db exec prisma generate
pnpm --filter @parking/db db:seed

echo "Edge DB setup completed"
