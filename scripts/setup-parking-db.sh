#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/use-parking-env.sh

sudo docker exec -i kosmos-parking-postgres psql -U postgres <<'SQL'
select 'create database parking'
where not exists (
  select from pg_database where datname = 'parking'
)\gexec
SQL

pnpm --filter @parking/db db:push
pnpm --filter @parking/db exec prisma generate
pnpm --filter @parking/db db:seed

echo "Parking DB setup completed"
