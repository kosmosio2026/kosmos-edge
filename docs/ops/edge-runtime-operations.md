KOSMOS Edge Runtime 운영 가이드

1. 서비스 구성

구분

Service

Port

Profile

Cloud API

kosmos-cloud-api.service

3000

cloud

Edge API

kosmos-edge-api.service

3001

edge

Cloud Web

kosmos-cloud-web.service

4000

cloud

Edge Web

kosmos-edge-web.service

4001

edge

Cloud Web은 .next-cloud, Edge Web은 .next-edge 빌드 산출물을 사용한다.

2. Edge API Key 운영

Cloud Admin에서 EdgeNode 상세 화면으로 이동한다.

/admin/edge-nodes/:edgeNodeId

API Key를 새로 발급하면 기존 active key는 자동 폐기된다.

Edge 서버에는 새 key를 apps/api/.env.edge에 반영한다.

APP_PROFILE=edge
APP_MODE=edge
EDGE_NODE_ID=cmr2fcdkn0001dob4zw6hwmb6
EDGE_API_KEY=발급받은_kedge_API_KEY
DEV_EDGE_API_KEY=발급받은_kedge_API_KEY
CLOUD_API_BASE_URL=http://localhost:3000/api
EDGE_SYNC_WORKER_ENABLED=true
EDGE_CLOUD_PUSH_WORKER_ENABLED=true

그 다음 Edge API를 재시작한다.

sudo systemctl restart kosmos-edge-api.service

Edge API 시작 시 EdgeLocalKeyBootstrapService가 .env.edge의 key를 읽어 Edge 로컬 DB EdgeNodeKey.keyHash를 자동 반영한다. 따라서 Edge DB key hash를 수동 SQL로 맞추지 않는다.

3. 운영 점검

cd ~/kosmos-edge
scripts/ops/check-edge-runtime.sh

정상 기준:

Cloud/Edge API active

Cloud/Edge Web active

Cloud handshake ok=true

Edge pull worker enabled=true, lastError=null

Edge cloud push worker enabled=true, lastError=null

Edge local key active 1개

4. SyncOutbox 확인

Edge pending / failed 확인

PGPASSWORD=postgres psql -h localhost -p 5435 -U postgres -d parking_edge -c '
SELECT
  so.id,
  de."eventId",
  de."eventType",
  so.destination,
  so.status,
  so."retryCount",
  so."lastError",
  so."nextRetryAt",
  so."createdAt",
  so."updatedAt"
FROM "SyncOutbox" so
LEFT JOIN "DomainEvent" de ON de.id = so."domainEventId"
WHERE so.status IN ('"'"'PENDING'"'"', '"'"'FAILED'"'"')
ORDER BY so."updatedAt" DESC
LIMIT 20;
'

Cloud pending / failed 확인

PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d parking_cloud -c '
SELECT
  so.id,
  de."eventId",
  de."eventType",
  so.destination,
  so.status,
  so."retryCount",
  so."lastError",
  so."nextRetryAt",
  so."createdAt",
  so."updatedAt"
FROM "SyncOutbox" so
LEFT JOIN "DomainEvent" de ON de.id = so."domainEventId"
WHERE so.status IN ('"'"'PENDING'"'"', '"'"'FAILED'"'"')
ORDER BY so."updatedAt" DESC
LIMIT 20;
'

수동 smoke test로 만든 FAILED 항목은 운영 기록으로 남겨도 된다.

5. AuditLog

EdgeNode 운영 변경은 AuditLog에 기록된다.

기록 대상:

EDGE_NODE_CREATED

EDGE_NODE_UPDATED

EDGE_NODE_DELETED

EDGE_NODE_KEY_ISSUED

EDGE_NODE_KEY_REVOKED

EDGE_PARKING_LOT_LINKED

EDGE_PARKING_LOT_UNLINKED

조회

PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d parking_cloud -c '
SELECT
  id,
  "userId",
  action,
  entity,
  "entityId",
  meta,
  "createdAt"
FROM "AuditLog"
WHERE entity IN ('"'"'EdgeNode'"'"', '"'"'EdgeNodeKey'"'"')
   OR action LIKE '"'"'EDGE_%'"'"'
ORDER BY "createdAt" DESC
LIMIT 20;
'

Cloud Admin에서는 EdgeNode 상세 하단의 Edge 운영 감사 로그에서 확인한다.

6. 장애 대응 요약

Cloud handshake 실패

확인 순서:

kosmos-cloud-api.service active 여부

.env.edge의 EDGE_API_KEY 값

Cloud DB EdgeNodeKey active key 존재 여부

EdgeNode status ACTIVE 여부

CLOUD_API_BASE_URL 네트워크 접근 여부

Edge worker lastError 발생

확인 순서:

sudo journalctl -u kosmos-edge-api.service -n 120 --no-pager

CLOUD_API_BASE_URL 확인

EDGE_API_KEY 확인

Cloud handshake 확인

SyncOutbox PENDING / FAILED 확인

LOCAL_SESSION_NOT_FOUND

Cloud → Edge 메시지가 특정 ParkingSession을 대상으로 내려왔지만 Edge 로컬 DB에 해당 session이 없다는 뜻이다.

수동 smoke test 찌꺼기라면 Cloud SyncOutbox를 FAILED 처리한다. 실제 운영 메시지라면 session sync 경로를 확인한다.