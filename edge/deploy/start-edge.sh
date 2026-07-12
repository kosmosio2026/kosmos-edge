#!/usr/bin/env bash
set -e

echo "[1/6] starting infra"
docker compose -f docker-compose.edge.yml up -d

echo "[2/6] waiting a bit"
sleep 5

echo "[3/6] db generate"
cd /home/project
npm run db:generate -w @parking/db

echo "[4/6] db push"
npm run db:push -w @parking/db

echo "[5/6] build shared/db"
npm run build -w @parking/shared
npm run build -w @parking/db

echo "[6/6] start apps manually in separate terminals"
echo "npm run dev -w @parking/api"
echo "npm run dev -w @parking/worker"
echo "npm run dev -w @parking/web"