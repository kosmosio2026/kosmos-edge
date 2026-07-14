#!/usr/bin/env bash
set -euo pipefail

EDGE_NODE_ID="${EDGE_NODE_ID:-cmr2fcdkn0001dob4zw6hwmb6}"

CLOUD_API_BASE="${CLOUD_API_BASE:-http://localhost:3000/api}"
EDGE_API_BASE="${EDGE_API_BASE:-http://localhost:3001/api}"
CLOUD_WEB_BASE="${CLOUD_WEB_BASE:-http://localhost:4000}"
EDGE_WEB_BASE="${EDGE_WEB_BASE:-http://localhost:4001}"

ADMIN_TOKEN="${ADMIN_TOKEN:-}"
NON_ADMIN_TOKEN="${NON_ADMIN_TOKEN:-}"

print_check() {
  echo
  echo "===== $1 ====="
}

check_status() {
  local label="$1"
  local expected="$2"
  local url="$3"
  local header="${4:-}"

  local status

  if [ -n "$header" ]; then
    status="$(curl -s -o /tmp/kosmos-smoke-response.txt -w "%{http_code}" -H "$header" "$url")"
  else
    status="$(curl -s -o /tmp/kosmos-smoke-response.txt -w "%{http_code}" "$url")"
  fi

  if [ "$status" = "$expected" ]; then
    echo "PASS $label -> $status"
  else
    echo "FAIL $label -> expected=$expected actual=$status"
    echo "----- response -----"
    cat /tmp/kosmos-smoke-response.txt || true
    exit 1
  fi
}

print_check "Unauthenticated API access should be 401"
check_status "Cloud /edge-nodes unauth" "401" "$CLOUD_API_BASE/edge-nodes"
check_status "Cloud /edge-nodes/:id/audit-logs unauth" "401" "$CLOUD_API_BASE/edge-nodes/$EDGE_NODE_ID/audit-logs"
check_status "Edge /edge-nodes unauth" "401" "$EDGE_API_BASE/edge-nodes"

print_check "Edge Web admin routes should redirect away"
EDGE_ADMIN_STATUS="$(curl -s -o /tmp/kosmos-smoke-response.txt -w "%{http_code}" -I "$EDGE_WEB_BASE/admin/edge-nodes")"
if [ "$EDGE_ADMIN_STATUS" = "307" ] || [ "$EDGE_ADMIN_STATUS" = "302" ] || [ "$EDGE_ADMIN_STATUS" = "308" ]; then
  echo "PASS Edge Web /admin/edge-nodes redirect -> $EDGE_ADMIN_STATUS"
else
  echo "FAIL Edge Web /admin/edge-nodes expected redirect actual=$EDGE_ADMIN_STATUS"
  cat /tmp/kosmos-smoke-response.txt || true
  exit 1
fi

if [ -n "$ADMIN_TOKEN" ]; then
  print_check "Admin token API access"
  check_status "Cloud /edge-nodes admin" "200" "$CLOUD_API_BASE/edge-nodes" "Authorization: Bearer $ADMIN_TOKEN"
  check_status "Cloud /edge-nodes/:id/audit-logs admin" "200" "$CLOUD_API_BASE/edge-nodes/$EDGE_NODE_ID/audit-logs" "Authorization: Bearer $ADMIN_TOKEN"

  echo
  echo "NOTE: Edge API /edge-nodes with ADMIN_TOKEN should usually be 403 because EdgeNode management is Cloud-only."
  EDGE_WITH_ADMIN_STATUS="$(curl -s -o /tmp/kosmos-smoke-response.txt -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$EDGE_API_BASE/edge-nodes")"
  if [ "$EDGE_WITH_ADMIN_STATUS" = "403" ]; then
    echo "PASS Edge /edge-nodes admin blocked by profile -> $EDGE_WITH_ADMIN_STATUS"
  else
    echo "WARN Edge /edge-nodes admin expected=403 actual=$EDGE_WITH_ADMIN_STATUS"
    cat /tmp/kosmos-smoke-response.txt || true
  fi
else
  echo
  echo "SKIP Admin-token checks. Set ADMIN_TOKEN to run them."
fi

if [ -n "$NON_ADMIN_TOKEN" ]; then
  print_check "Non-admin API access should be 403"
  check_status "Cloud /edge-nodes non-admin" "403" "$CLOUD_API_BASE/edge-nodes" "Authorization: Bearer $NON_ADMIN_TOKEN"
else
  echo
  echo "SKIP Non-admin-token checks. Set NON_ADMIN_TOKEN to run them."
fi

echo
echo "All required smoke checks passed."
