'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type EdgeNodeAuditLog = {
  id: string;
  action: string;
  userId: string | null;
  meta: unknown;
  createdAt: string;
};

type EdgeNodeAuditLogsResponse = {
  ok: boolean;
  items: EdgeNodeAuditLog[];
};

const actionLabelMap: Record<string, string> = {
  EDGE_NODE_CREATED: '노드 생성',
  EDGE_NODE_UPDATED: '노드 수정',
  EDGE_NODE_DELETED: '노드 삭제 처리',
  EDGE_NODE_KEY_ISSUED: 'API Key 발급',
  EDGE_NODE_KEY_REVOKED: 'API Key 폐기',
  EDGE_PARKING_LOT_LINKED: '주차장 연결',
  EDGE_PARKING_LOT_UNLINKED: '주차장 해제',
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function actionLabel(action: string) {
  return actionLabelMap[action] ?? action;
}

function actionBadgeClassName(action: string) {
  if (action.includes('KEY_ISSUED')) return 'bg-emerald-50 text-emerald-700';
  if (action.includes('KEY_REVOKED')) return 'bg-red-50 text-red-700';
  if (action.includes('PARKING_LOT_LINKED')) return 'bg-blue-50 text-blue-700';
  if (action.includes('PARKING_LOT_UNLINKED')) return 'bg-amber-50 text-amber-700';
  if (action.includes('DELETED')) return 'bg-red-50 text-red-700';
  if (action.includes('UPDATED')) return 'bg-slate-100 text-slate-700';
  if (action.includes('CREATED')) return 'bg-emerald-50 text-emerald-700';

  return 'bg-slate-100 text-slate-700';
}

function readMetaString(meta: unknown, keys: string[]) {
  if (!isRecord(meta)) return null;

  for (const key of keys) {
    const value = meta[key];

    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
  }

  return null;
}

function summarizeAuditLog(log: EdgeNodeAuditLog) {
  const keyId = readMetaString(log.meta, ['keyId', 'edgeNodeKeyId']);
  const parkingLotName = readMetaString(log.meta, ['parkingLotName', 'lotName', 'name']);
  const parkingLotId = readMetaString(log.meta, ['parkingLotId']);
  const edgeNodeCode = readMetaString(log.meta, ['edgeNodeCode', 'code']);
  const revokeExisting = readMetaString(log.meta, ['revokeExistingActiveKeys']);
  const isPrimary = readMetaString(log.meta, ['isPrimary']);

  if (log.action === 'EDGE_NODE_KEY_ISSUED') {
    return [
      keyId ? `Key ID: ${keyId}` : null,
      revokeExisting ? `기존 키 폐기: ${revokeExisting}` : null,
    ].filter(Boolean).join(' · ') || '새 API Key가 발급되었습니다.';
  }

  if (log.action === 'EDGE_NODE_KEY_REVOKED') {
    return keyId ? `폐기된 Key ID: ${keyId}` : 'API Key가 폐기되었습니다.';
  }

  if (log.action === 'EDGE_PARKING_LOT_LINKED') {
    return [
      `주차장: ${parkingLotName ?? parkingLotId ?? '-'}`,
      isPrimary ? `Primary: ${isPrimary}` : null,
    ].filter(Boolean).join(' · ');
  }

  if (log.action === 'EDGE_PARKING_LOT_UNLINKED') {
    return `해제된 주차장: ${parkingLotName ?? parkingLotId ?? '-'}`;
  }

  if (log.action === 'EDGE_NODE_CREATED') {
    return edgeNodeCode ? `Edge code: ${edgeNodeCode}` : 'EdgeNode가 생성되었습니다.';
  }

  if (log.action === 'EDGE_NODE_UPDATED') {
    return edgeNodeCode ? `Edge code: ${edgeNodeCode}` : 'EdgeNode 정보가 수정되었습니다.';
  }

  if (log.action === 'EDGE_NODE_DELETED') {
    return edgeNodeCode ? `삭제 처리된 Edge code: ${edgeNodeCode}` : 'EdgeNode가 삭제 처리되었습니다.';
  }

  return '-';
}

function formatMeta(meta: unknown) {
  if (!meta) return '-';

  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

export function EdgeNodeAuditLogs({ edgeNodeId }: { edgeNodeId: string }) {
  const [items, setItems] = useState<EdgeNodeAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<EdgeNodeAuditLogsResponse>(
        `/edge-nodes/${edgeNodeId}/audit-logs`,
      );

      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '감사 로그를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [edgeNodeId]);

  const latestItem = items[0];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Audit Log
          </p>
          <h2 className="mt-1 font-semibold">Edge 운영 감사 로그</h2>
          <p className="mt-1 text-xs text-slate-500">
            EdgeNode 수정, API Key 발급/폐기, 주차장 연결/해제 이력을 표시합니다.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? '갱신 중...' : '새로고침'}
          </button>

          <div className="text-xs text-slate-400">
            총 {items.length}건
            {latestItem ? ` · 최근 ${formatDate(latestItem.createdAt)}` : ''}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
          감사 로그를 불러오는 중입니다.
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
          아직 표시할 감사 로그가 없습니다.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">시간</th>
                <th className="px-4 py-3">작업</th>
                <th className="px-4 py-3">요약</th>
                <th className="px-4 py-3">사용자</th>
                <th className="px-4 py-3">상세</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {formatDate(item.createdAt)}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${actionBadgeClassName(
                        item.action,
                      )}`}
                    >
                      {actionLabel(item.action)}
                    </span>
                    <div className="mt-1 font-mono text-[11px] text-slate-400">{item.action}</div>
                  </td>

                  <td className="min-w-64 px-4 py-3 text-sm text-slate-700">
                    {summarizeAuditLog(item)}
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {item.userId ?? '-'}
                  </td>

                  <td className="min-w-96 px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
                        meta 보기
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                        {formatMeta(item.meta)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-400">edgeNodeId: {edgeNodeId}</div>
    </section>
  );
}
