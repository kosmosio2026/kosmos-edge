'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type AuditLogItem = {
  id: string;
  userId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

type AuditLogsResponse = {
  ok: boolean;
  items: AuditLogItem[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    EDGE_NODE_CREATED: '노드 생성',
    EDGE_NODE_UPDATED: '노드 수정',
    EDGE_NODE_DELETED: '노드 삭제 처리',
    EDGE_NODE_KEY_ISSUED: 'API Key 발급',
    EDGE_NODE_KEY_REVOKED: 'API Key 폐기',
    EDGE_PARKING_LOT_LINKED: '주차장 연결',
    EDGE_PARKING_LOT_UNLINKED: '주차장 해제',
  };

  return labels[action] ?? action;
}

function formatMeta(meta: Record<string, unknown> | null) {
  if (!meta) return '-';

  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

export function EdgeNodeAuditLogs({ edgeNodeId }: { edgeNodeId: string }) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<AuditLogsResponse>(
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

  return (
    <div
      style={{
        display: 'block',
        width: '100%',
        minHeight: '220px',
        marginTop: '24px',
        padding: '24px',
        border: '2px solid #0f172a',
        borderRadius: '20px',
        background: '#ffffff',
        color: '#0f172a',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: '#64748b',
              textTransform: 'uppercase',
            }}
          >
            Audit Log
          </div>
          <h2
            style={{
              marginTop: '6px',
              fontSize: '22px',
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            Edge 운영 감사 로그
          </h2>
          <p style={{ marginTop: '6px', fontSize: '14px', color: '#475569' }}>
            EdgeNode 수정, API Key 발급/폐기, 주차장 연결/해제 이력을 표시합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          style={{
            height: '40px',
            padding: '0 16px',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            background: '#f8fafc',
            color: '#0f172a',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          새로고침
        </button>
      </div>

      <div style={{ marginTop: '18px' }}>
        {error ? (
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        ) : loading ? (
          <div
            style={{
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              textAlign: 'center',
              fontSize: '14px',
            }}
          >
            감사 로그를 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              textAlign: 'center',
              fontSize: '14px',
            }}
          >
            아직 표시할 감사 로그가 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    시간
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    작업
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    사용자
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    상세
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 700 }}>{actionLabel(item.action)}</div>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                        {item.action}
                      </div>
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', fontFamily: 'monospace' }}>
                      {item.userId ?? '-'}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                      <pre
                        style={{
                          maxHeight: '160px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          margin: 0,
                          padding: '12px',
                          borderRadius: '12px',
                          background: '#0f172a',
                          color: '#f8fafc',
                          fontSize: '12px',
                          lineHeight: '18px',
                        }}
                      >
                        {formatMeta(item.meta)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
        edgeNodeId: {edgeNodeId}
      </div>
    </div>
  );
}
