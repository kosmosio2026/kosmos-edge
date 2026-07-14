#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/kosmos-edge}"
EDGE_NODE_ID_DEFAULT="cmr2fcdkn0001dob4zw6hwmb6"

cd "$PROJECT_ROOT"

EDGE_NODE_ID_VALUE="${EDGE_NODE_ID:-$(grep -m1 '^EDGE_NODE_ID=' apps/api/.env.edge 2>/dev/null | cut -d= -f2- | sed 's/^"//;s/"$//')}"
EDGE_NODE_ID_VALUE="${EDGE_NODE_ID_VALUE:-$EDGE_NODE_ID_DEFAULT}"

EDGE_API_KEY_VALUE="$(grep -m1 '^EDGE_API_KEY=' apps/api/.env.edge 2>/dev/null | cut -d= -f2- | sed 's/^"//;s/"$//' || true)"

CLOUD_API_BASE="${CLOUD_API_BASE:-http://localhost:3000/api}"
EDGE_API_BASE="${EDGE_API_BASE:-http://localhost:3001/api}"

CLOUD_DB_PORT="${CLOUD_DB_PORT:-5434}"
EDGE_DB_PORT="${EDGE_DB_PORT:-5435}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
CLOUD_DB="${CLOUD_DB:-parking_cloud}"
EDGE_DB="${EDGE_DB:-parking_edge}"

export PGPASSWORD="$DB_PASSWORD"

section() {
  echo
  echo "===== $1 ====="
}

check_service() {
  local service="$1"
  if systemctl is-active --quiet "$service"; then
    echo "PASS $service active"
  else
    echo "FAIL $service not active"
    systemctl status "$service" --no-pager | sed -n '1,40p' || true
  fi
}

check_http_json() {
  local label="$1"
  local url="$2"
  local header="${3:-}"

  echo
  echo "----- $label -----"

  if [ -n "$header" ]; then
    curl -s -H "$header" "$url" | jq . || true
  else
    curl -s "$url" | jq . || true
  fi
}

section "Service status"
check_service kosmos-cloud-api.service
check_service kosmos-edge-api.service
check_service kosmos-cloud-web.service
check_service kosmos-edge-web.service

section "Listening ports"
sudo ss -ltnp | grep -E ':3000|:3001|:4000|:4001' || true

section ".env.edge core values"
grep -n 'APP_PROFILE\|APP_MODE\|EDGE_NODE_ID\|EDGE_API_KEY\|DEV_EDGE_API_KEY\|CLOUD_API_BASE_URL\|EDGE_SYNC_WORKER_ENABLED\|EDGE_CLOUD_PUSH_WORKER_ENABLED' \
  apps/api/.env.edge \
  | sed -E 's/(EDGE_API_KEY=).+/\1***MASKED***/; s/(DEV_EDGE_API_KEY=).+/\1***MASKED***/' || true

section "Cloud Web runtime env"
PID="$(systemctl show -p MainPID --value kosmos-cloud-web.service || true)"
echo "PID=$PID"
if [ -n "$PID" ] && [ "$PID" != "0" ]; then
  sudo tr '\0' '\n' < "/proc/$PID/environ" \
    | grep -E 'NODE_ENV|NEXT_DIST_DIR|NEXT_PUBLIC_APP_PROFILE|NEXT_PUBLIC_API_BASE_URL|API_BASE_URL|PORT' || true
fi

section "Edge local key status"
psql -h localhost -p "$EDGE_DB_PORT" -U "$DB_USER" -d "$EDGE_DB" -c "
SELECT
  en.id AS edge_node_id,
  en.code,
  en.name,
  en.status AS edge_status,
  enk.\"keyId\",
  enk.\"isActive\",
  enk.\"revokedAt\",
  enk.\"createdAt\",
  enk.\"updatedAt\"
FROM \"EdgeNode\" en
LEFT JOIN \"EdgeNodeKey\" enk ON enk.\"edgeNodeId\" = en.id
WHERE en.id = '${EDGE_NODE_ID_VALUE}'
ORDER BY enk.\"createdAt\" DESC
LIMIT 10;
"

section "Cloud edge key status"
psql -h localhost -p "$CLOUD_DB_PORT" -U "$DB_USER" -d "$CLOUD_DB" -c "
SELECT
  en.id AS edge_node_id,
  en.code,
  en.name,
  en.status AS edge_status,
  enk.\"keyId\",
  enk.\"isActive\",
  enk.\"revokedAt\",
  enk.\"createdAt\",
  enk.\"updatedAt\"
FROM \"EdgeNode\" en
LEFT JOIN \"EdgeNodeKey\" enk ON enk.\"edgeNodeId\" = en.id
WHERE en.id = '${EDGE_NODE_ID_VALUE}'
ORDER BY enk.\"createdAt\" DESC
LIMIT 10;
"

if [ -z "$EDGE_API_KEY_VALUE" ]; then
  section "API checks skipped"
  echo "EDGE_API_KEY was not found in apps/api/.env.edge"
else
  section "Cloud handshake"
  check_http_json \
    "Cloud handshake" \
    "$CLOUD_API_BASE/edge/handshake" \
    "x-edge-api-key: $EDGE_API_KEY_VALUE"

  section "Edge worker status"
  check_http_json \
    "Edge pull worker" \
    "$EDGE_API_BASE/sync/edge/worker/status" \
    "x-edge-api-key: $EDGE_API_KEY_VALUE"

  check_http_json \
    "Edge cloud push worker" \
    "$EDGE_API_BASE/sync/edge/worker/cloud-push/status" \
    "x-edge-api-key: $EDGE_API_KEY_VALUE"
fi

section "Edge pending SyncOutbox"
psql -h localhost -p "$EDGE_DB_PORT" -U "$DB_USER" -d "$EDGE_DB" -c "
SELECT
  so.id,
  de.\"eventId\",
  de.\"eventType\",
  so.destination,
  so.status,
  so.\"retryCount\",
  so.\"lastError\",
  so.\"nextRetryAt\",
  so.\"createdAt\",
  so.\"updatedAt\"
FROM \"SyncOutbox\" so
LEFT JOIN \"DomainEvent\" de ON de.id = so.\"domainEventId\"
WHERE so.status IN ('PENDING', 'FAILED')
ORDER BY so.\"updatedAt\" DESC
LIMIT 20;
"

section "Cloud pending SyncOutbox"
psql -h localhost -p "$CLOUD_DB_PORT" -U "$DB_USER" -d "$CLOUD_DB" -c "
SELECT
  so.id,
  de.\"eventId\",
  de.\"eventType\",
  so.destination,
  so.status,
  so.\"retryCount\",
  so.\"lastError\",
  so.\"nextRetryAt\",
  so.\"createdAt\",
  so.\"updatedAt\"
FROM \"SyncOutbox\" so
LEFT JOIN \"DomainEvent\" de ON de.id = so.\"domainEventId\"
WHERE so.status IN ('PENDING', 'FAILED')
ORDER BY so.\"updatedAt\" DESC
LIMIT 20;
"

section "Recent Edge API logs"
sudo journalctl -u kosmos-edge-api.service -n 40 --no-pager \
  | grep -E 'EdgeLocalKeyBootstrapService|EdgeSyncWorkerService|EdgeCloudPushWorkerService|ERROR|WARN|failed|LOCAL_SESSION_NOT_FOUND' || true

section "Summary"
echo "Check complete."
echo "Normal baseline:"
echo "- services active"
echo "- handshake ok=true"
echo "- pull/cloud-push worker enabled=true and lastError=null"
echo "- Edge local key has exactly one active key"
echo "- unexpected PENDING/FAILED sync rows should be reviewed"
