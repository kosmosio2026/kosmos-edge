#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/use-cloud-env.sh

sudo docker exec -i kosmos-cloud-postgres psql -U postgres <<'SQL'
select 'create database parking_cloud'
where not exists (
  select from pg_database where datname = 'parking_cloud'
)\gexec
SQL

pnpm --filter @parking/db db:push
pnpm --filter @parking/db exec prisma generate
pnpm --filter @parking/db db:seed

echo "Cloud DB setup completed"
