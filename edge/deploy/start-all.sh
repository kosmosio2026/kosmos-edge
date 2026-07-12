#!/usr/bin/env bash
set -e

echo "[edge] starting infra"
docker compose -f docker-compose.edge.yml up -d

echo "[edge] waiting 5 seconds"
sleep 5

echo "[edge] prisma"
cd /home/project
npm run db:generate -w @parking/db
npm run db:push -w @parking/db

echo "[edge] builds"
npm run build -w @parking/shared
npm run build -w @parking/db

echo "[edge] done"
echo "Run separately:"
echo "npm run dev -w @parking/api"
echo "npm run dev -w @parking/worker"
echo "npm run dev -w @parking/web"