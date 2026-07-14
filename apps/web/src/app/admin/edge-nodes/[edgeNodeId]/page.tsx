'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { EdgeNodeAuditLogs } from './edge-node-audit-logs';

type EdgeNodeManager = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  companyName: string | null;
  department: string | null;
  isApproved: boolean | null;
  parkingLotIds: string[];
};

type EdgeNodeKey = {
  id: string;
  keyId: string;
  isActive: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type EdgeParkingLotLink = {
  id: string;
  edgeNodeId: string;
  parkingLotId: string;
  isPrimary: boolean;
  createdAt: string;
  parkingLot?: {
    id: string;
    code: string;
    name: string;
    tenantId?: string | null;
  };
};

type EdgeNodeItem = {
  id: string;
  code: string;
  name: string;
  tenantId: string | null;
  tenantName: string | null;
  status: string;
  appVersion: string | null;
  lastSeenAt: string | null;
  lastConnectedAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  keys: EdgeNodeKey[];
  managers?: EdgeNodeManager[];
  parkingLots: EdgeParkingLotLink[];
};

type ParkingLotOption = {
  id: string;
  code: string;
  name: string;
  tenantId: string;
  tenantName: string | null;
  isActive: boolean;
  address: string | null;
  region: string | null;
  district: string | null;
  edgeLinks: Array<{
    id: string;
    edgeNodeId: string;
    isPrimary: boolean;
    edgeNode?: {
      id: string;
      code: string;
      name: string;
      status: string;
    };
  }>;
};

type EdgeNodeResponse = {
  ok: boolean;
  item: EdgeNodeItem;
};

type ParkingLotOptionsResponse = {
  ok: boolean;
  items: ParkingLotOption[];
};

type IssueKeyResponse = {
  ok: boolean;
  apiKey: string;
  key: EdgeNodeKey;
  warning?: string;
};

function buildEdgeEnvBlock(item: EdgeNodeItem, apiKey: string) {
  const cloudApiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, '/api') ??
    'http://112.171.47.68:3000/api';

  return [
    'APP_PROFILE=edge',
    'APP_MODE=edge',
    `EDGE_NODE_ID=${item.id}`,
    `EDGE_API_KEY=${apiKey}`,
    `DEV_EDGE_API_KEY=${apiKey}`,
    `CLOUD_API_BASE_URL=${cloudApiBaseUrl}`,
    'EDGE_SYNC_WORKER_ENABLED=true',
    'EDGE_CLOUD_PUSH_WORKER_ENABLED=true',
  ].join('\n');
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
  });
}


function countActiveKeys(keys: EdgeNodeKey[]) {
  return keys.filter((key) => key.isActive && !key.revokedAt).length;
}

function countRevokedKeys(keys: EdgeNodeKey[]) {
  return keys.filter((key) => !key.isActive || Boolean(key.revokedAt)).length;
}

function secondsSince(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
}

function formatElapsed(value?: string | null) {
  const seconds = secondsSince(value);

  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}초 전`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function getEdgeHealth(item: EdgeNodeItem) {
  const activeKeys = countActiveKeys(item.keys ?? []);
  const lastSeenSeconds = secondsSince(item.lastSeenAt);

  if (item.status === 'DELETED') {
    return {
      label: 'DELETED',
      className: 'bg-red-50 text-red-700',
      description: '삭제 처리된 EdgeNode입니다.',
    };
  }

  if (activeKeys === 0) {
    return {
      label: 'KEY_REQUIRED',
      className: 'bg-red-50 text-red-700',
      description: '활성 API Key가 없어 Edge 인증이 실패할 수 있습니다.',
    };
  }

  if (lastSeenSeconds === null) {
    return {
      label: 'UNKNOWN',
      className: 'bg-slate-100 text-slate-600',
      description: '아직 Cloud에서 확인된 handshake 또는 lastSeen 이력이 없습니다.',
    };
  }

  if (lastSeenSeconds <= 300) {
    return {
      label: 'ONLINE',
      className: 'bg-emerald-50 text-emerald-700',
      description: '최근 5분 이내 Edge 연결 이력이 있습니다.',
    };
  }

  if (lastSeenSeconds <= 1800) {
    return {
      label: 'STALE',
      className: 'bg-amber-50 text-amber-700',
      description: '최근 30분 이내 연결 이력은 있으나 최신 상태 확인이 필요합니다.',
    };
  }

  return {
    label: 'OFFLINE',
    className: 'bg-red-50 text-red-700',
    description: '최근 30분 이상 Edge 연결 이력이 없습니다.',
  };
}

function EdgeNodeStatusSummaryCard({ item }: { item: EdgeNodeItem }) {
  const activeKeys = countActiveKeys(item.keys ?? []);
  const revokedKeys = countRevokedKeys(item.keys ?? []);
  const parkingLotCount = item.parkingLots?.length ?? 0;
  const managerCount = item.managers?.length ?? 0;
  const health = getEdgeHealth(item);
  const primaryLot =
    item.parkingLots?.find((link) => link.isPrimary)?.parkingLot ??
    item.parkingLots?.[0]?.parkingLot ??
    null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Status Summary
          </p>
          <h2 className="mt-1 font-semibold">Edge 운영 상태</h2>
          <p className="mt-1 text-xs text-slate-500">
            Cloud DB의 EdgeNode 정보 기준으로 계산한 요약 상태입니다.
          </p>
        </div>

        <div className="text-left md:text-right">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${health.className}`}>
            {health.label}
          </span>
          <div className="mt-2 max-w-md text-xs text-slate-500">{health.description}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">Last Seen</div>
          <div className="mt-1 text-sm font-semibold">{formatElapsed(item.lastSeenAt)}</div>
          <div className="mt-1 text-xs text-slate-400">{formatDate(item.lastSeenAt)}</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">Active API Key</div>
          <div className="mt-1 text-2xl font-bold">{activeKeys}</div>
          <div className="mt-1 text-xs text-slate-400">revoked {revokedKeys}</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">연결 주차장</div>
          <div className="mt-1 text-2xl font-bold">{parkingLotCount}</div>
          <div className="mt-1 truncate text-xs text-slate-400">
            Primary: {primaryLot?.name ?? '-'}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">담당 Manager</div>
          <div className="mt-1 text-2xl font-bold">{managerCount}</div>
          <div className="mt-1 text-xs text-slate-400">주차장 권한 기준 자동 매칭</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Last Connected</div>
          <div className="mt-1">{formatDate(item.lastConnectedAt)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Last Sync</div>
          <div className="mt-1">{formatDate(item.lastSyncAt)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">App Version</div>
          <div className="mt-1">{item.appVersion ?? '-'}</div>
        </div>
      </div>
    </section>
  );
}


function EdgeNodeOperationGuide({ item }: { item: EdgeNodeItem }) {
  const edgeNodeId = item.id;
  const edgeCode = item.code;

  const envExample = [
    'APP_PROFILE=edge',
    'APP_MODE=edge',
    `EDGE_NODE_ID=${edgeNodeId}`,
    'EDGE_API_KEY=Cloud_Admin에서_발급한_kedge_API_KEY',
    'DEV_EDGE_API_KEY=Cloud_Admin에서_발급한_kedge_API_KEY',
    'CLOUD_API_BASE_URL=http://localhost:3000/api',
    'EDGE_SYNC_WORKER_ENABLED=true',
    'EDGE_CLOUD_PUSH_WORKER_ENABLED=true',
  ].join('\n');

  const verifyCommands = [
    'cd ~/kosmos-edge',
    '',
    'EDGE_API_KEY_VALUE="$(grep -m1 \'^EDGE_API_KEY=\' apps/api/.env.edge | cut -d= -f2- | sed \'s/^"//;s/"$//\')"',
    '',
    'echo "===== Cloud handshake ====="',
    'curl -s -H "x-edge-api-key: ${EDGE_API_KEY_VALUE}" http://localhost:3000/api/edge/handshake | jq',
    '',
    'echo "===== Edge pull worker ====="',
    'curl -s -H "x-edge-api-key: ${EDGE_API_KEY_VALUE}" http://localhost:3001/api/sync/edge/worker/status | jq',
    '',
    'echo "===== Edge cloud push worker ====="',
    'curl -s -H "x-edge-api-key: ${EDGE_API_KEY_VALUE}" http://localhost:3001/api/sync/edge/worker/cloud-push/status | jq',
  ].join('\n');

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Edge 운영 절차
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            설치 / 교체 / API Key 회전 체크리스트
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            {edgeCode} 노드에 새 API Key를 적용한 뒤에는 Cloud handshake, pull worker,
            cloud push worker 상태를 반드시 확인해야 합니다.
          </p>
        </div>

        <div className="rounded-2xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <div>Edge Node ID</div>
          <div className="mt-1 font-mono text-slate-900">{edgeNodeId}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900">1. 설치</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Cloud Admin에서 EdgeNode를 생성합니다.</li>
            <li>주차장을 연결하고 담당 Manager 매칭을 확인합니다.</li>
            <li>API Key를 발급합니다.</li>
            <li>Edge 서버의 <span className="font-mono">apps/api/.env.edge</span>에 적용합니다.</li>
            <li>Edge API를 재시작하고 handshake를 확인합니다.</li>
          </ol>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900">2. 교체</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>새 EdgeNode를 먼저 생성합니다.</li>
            <li>기존 주차장 연결을 새 EdgeNode로 이관합니다.</li>
            <li>새 Edge 서버에서 worker 상태를 확인합니다.</li>
            <li>기존 EdgeNode는 즉시 삭제하지 말고 비활성/삭제 처리 전 로그를 확인합니다.</li>
          </ol>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900">3. Key 회전</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>새 API Key를 발급합니다.</li>
            <li>Edge 서버 <span className="font-mono">.env.edge</span>에 새 키를 반영합니다.</li>
            <li>로컬 Edge API가 key guard를 쓰는 경우 Edge DB에도 key hash를 반영합니다.</li>
            <li>handshake와 worker status가 정상인 것을 확인한 뒤 이전 키를 폐기합니다.</li>
          </ol>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-800">.env.edge 예시</div>
          <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {envExample}
          </pre>
          <p className="mt-2 text-xs text-amber-800">
            개발 서버처럼 Cloud API와 Edge API가 같은 장비에 있으면 CLOUD_API_BASE_URL은
            localhost 사용이 안전합니다. 실제 현장 Edge 장비에서는 Cloud API에 접근 가능한 URL을 사용하세요.
          </p>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-800">적용 후 검증 명령</div>
          <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {verifyCommands}
          </pre>
          <p className="mt-2 text-xs text-amber-800">
            정상 기준: handshake ok, worker enabled true, lastError null, Edge → Cloud push 이벤트 ACKED.
          </p>
        </div>
      </div>
    </section>
  );
}


export default function AdminEdgeNodeDetailPage() {
  const params = useParams();
  const edgeNodeIdParam = params?.edgeNodeId;
  const edgeNodeId = Array.isArray(edgeNodeIdParam) ? edgeNodeIdParam[0] : edgeNodeIdParam;

  const [item, setItem] = useState<EdgeNodeItem | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLotOption[]>([]);
  const [selectedParkingLotId, setSelectedParkingLotId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuingKey, setIssuingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedApiKey, setIssuedApiKey] = useState<{
    keyId: string;
    apiKey: string;
  } | null>(null);
  const [preserveExistingKeys, setPreserveExistingKeys] = useState(false);

  async function load() {
    if (!edgeNodeId) return;

    setLoading(true);
    setError(null);

    try {
      const [nodeData, lotData] = await Promise.all([
        apiFetch<EdgeNodeResponse>(`/edge-nodes/${edgeNodeId}`),
        apiFetch<ParkingLotOptionsResponse>('/edge-nodes/options/parking-lots'),
      ]);

      setItem(nodeData.item);
      setParkingLots(lotData.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edge 노드 상세 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [edgeNodeId]);

  const connectedParkingLotIds = useMemo(
    () => new Set((item?.parkingLots ?? []).map((link) => link.parkingLotId)),
    [item],
  );

  const selectableParkingLots = useMemo(
    () => parkingLots.filter((lot) => !connectedParkingLotIds.has(lot.id)),
    [parkingLots, connectedParkingLotIds],
  );

  async function attachParkingLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!edgeNodeId || !selectedParkingLotId) {
      setError('연결할 주차장을 선택하세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/edge-nodes/${edgeNodeId}/parking-lots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parkingLotId: selectedParkingLotId,
          isPrimary,
        }),
      });

      setSelectedParkingLotId('');
      setIsPrimary(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '주차장 연결에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function issueKey() {
    const revokeExistingActiveKeys = !preserveExistingKeys;
    if (!edgeNodeId || !item) return;

    const rotationModeLabel = revokeExistingActiveKeys
      ? '기존 active key를 즉시 폐기하고 새 key를 발급합니다.'
      : '기존 active key를 유지한 채 새 key를 추가 발급합니다.';

    if (
      !confirm(
        `${item.name} API Key를 새로 발급할까요?\n\n${rotationModeLabel}\n\n키 원문은 한 번만 표시됩니다.`,
      )
    ) {
      return;
    }

    setIssuingKey(true);
    setError(null);
    setIssuedApiKey(null);

    try {
      const data = await apiFetch<IssueKeyResponse>(`/edge-nodes/${edgeNodeId}/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ revokeExistingActiveKeys }),
      });

      setIssuedApiKey({
        keyId: data.key.keyId,
        apiKey: data.apiKey,
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API Key 발급에 실패했습니다.');
    } finally {
      setIssuingKey(false);
    }
  }

  async function revokeKey(key: EdgeNodeKey) {
    if (!edgeNodeId || !item) return;

    if (!confirm(`${item.name} / ${key.keyId} 키를 폐기할까요?`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/edge-nodes/${edgeNodeId}/keys/${encodeURIComponent(key.keyId)}/revoke`, {
        method: 'POST',
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API Key 폐기에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function detachParkingLot(link: EdgeParkingLotLink) {
    if (!edgeNodeId) return;

    const lotName = link.parkingLot?.name ?? link.parkingLotId;

    if (!confirm(`${lotName} 연결을 해제할까요?`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/edge-nodes/${edgeNodeId}/parking-lots/${link.parkingLotId}`, {
        method: 'DELETE',
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '주차장 연결 해제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-8 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          불러오는 중...
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-slate-50 px-8 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-2xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
          {error ?? 'Edge 노드를 찾을 수 없습니다.'}
        </div>
      </main>
    );
  }

  const managers = item.managers ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-8 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <a href="/admin/edge-nodes" className="text-sm text-slate-500 hover:text-slate-900">
            ← Edge 목록으로
          </a>
        </div>

        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Edge Node Detail</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{item.name}</h1>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
            <div>Code: {item.code}</div>
            <div>Status: {item.status}</div>
            <div>Version: {item.appVersion ?? '-'}</div>
            <div>Tenant: {item.tenantName ?? item.tenantId ?? '-'}</div>
            <div>Last Seen: {formatDate(item.lastSeenAt)}</div>
            <div>Last Sync: {formatDate(item.lastSyncAt)}</div>
          </div>
        </header>

        {item ? <EdgeNodeStatusSummaryCard item={item} /> : null}

        {issuedApiKey ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
            <div className="font-semibold">API Key가 발급되었습니다. 이 값은 한 번만 표시됩니다.</div>
            <div className="mt-3 grid gap-2">
              <div>Key ID: {issuedApiKey.keyId}</div>
              <pre className="overflow-x-auto rounded-xl bg-white p-3 text-xs">{issuedApiKey.apiKey}</pre>
            </div>

            <div className="mt-4 font-semibold">Edge 서버 .env.edge 적용 블록</div>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs">
              {buildEdgeEnvBlock(item, issuedApiKey.apiKey)}
            </pre>

            <div className="mt-3 text-xs text-amber-800">
              기존 운영 Edge의 키를 교체할 때는 위 값을 apps/api/.env.edge에 반영한 뒤 kosmos-edge-api.service를 재시작하세요.
            </div>
          </section>
        ) : null}

        {item ? <EdgeNodeOperationGuide item={item} /> : null}

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold">주차장 연결</h2>
            <p className="mt-1 text-xs text-slate-500">
              EdgeNode에 주차장을 연결하면 해당 주차장을 담당하는 Manager가 자동으로 매칭됩니다.
            </p>
          </div>

          <form onSubmit={attachParkingLot} className="mb-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <select
              value={selectedParkingLotId}
              onChange={(event) => setSelectedParkingLotId(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            >
              <option value="">연결할 주차장 선택</option>
              {selectableParkingLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name} / {lot.code} {lot.tenantName ? ` / ${lot.tenantName}` : ''}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(event) => setIsPrimary(event.target.checked)}
              />
              Primary
            </label>

            <button
              type="submit"
              disabled={saving || !selectedParkingLotId}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              연결
            </button>
          </form>

          {item.parkingLots.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              연결된 주차장이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">주차장</th>
                    <th className="px-4 py-3">코드</th>
                    <th className="px-4 py-3">Primary</th>
                    <th className="px-4 py-3">연결일</th>
                    <th className="px-4 py-3">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {item.parkingLots.map((link) => (
                    <tr key={link.id}>
                      <td className="px-4 py-3 font-medium">
                        {link.parkingLot?.name ?? link.parkingLotId}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {link.parkingLot?.code ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        {link.isPrimary ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            Primary
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(link.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void detachParkingLot(link)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          연결 해제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">담당 Manager</h2>
          <p className="mt-1 text-xs text-slate-500">
            연결된 주차장의 ManagerParkingLot 권한을 기준으로 자동 표시됩니다.
          </p>

          {managers.length === 0 ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              매칭된 Manager가 없습니다.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {managers.map((manager) => (
                <div key={manager.userId} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="font-semibold">{manager.name}</div>
                  <div className="mt-1 text-slate-500">{manager.email ?? '-'}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {manager.companyName ?? '-'} / {manager.department ?? '-'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    담당 연결 주차장 {manager.parkingLotIds?.length ?? 0}개
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">API Key</h2>
              <p className="mt-1 text-xs text-slate-500">
                키 원문은 발급 순간에만 표시됩니다. 분실 시 새 키를 발급하고 기존 키를 폐기하세요.
              </p>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-snug text-amber-900">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={preserveExistingKeys}
                onChange={(event) => setPreserveExistingKeys(event.target.checked)}
              />
              <span>
                기존 active API Key 유지
                <br />
                <span className="text-amber-700">무중단 회전 시 사용</span>
              </span>
            </label>

            <button
              type="button"
              disabled={issuingKey || item.status === 'DELETED'}
              onClick={() => void issueKey()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {issuingKey ? '발급 중...' : 'API Key 발급'}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Key ID</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">발급일</th>
                  <th className="px-4 py-3">폐기일</th>
                  <th className="px-4 py-3">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {item.keys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      발급된 키가 없습니다.
                    </td>
                  </tr>
                ) : (
                  item.keys.map((key) => (
                    <tr key={key.id}>
                      <td className="px-4 py-3 font-medium">{key.keyId}</td>
                      <td className="px-4 py-3">
                        {key.isActive && !key.revokedAt ? 'ACTIVE' : 'REVOKED'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(key.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(key.revokedAt)}</td>
                      <td className="px-4 py-3">
                        {key.isActive && !key.revokedAt ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void revokeKey(key)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            폐기
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        {edgeNodeId ? <EdgeNodeAuditLogs edgeNodeId={edgeNodeId} /> : null}

      </div>
    </main>
  );
}
