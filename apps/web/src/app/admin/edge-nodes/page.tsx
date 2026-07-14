'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type EdgeNodeKey = {
  id: string;
  keyId: string;
  isActive: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

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

type EdgeNodesResponse = {
  ok: boolean;
  items: EdgeNodeItem[];
};

type EdgeNodeResponse = {
  ok: boolean;
  item: EdgeNodeItem;
};

type IssueKeyResponse = {
  ok: boolean;
  apiKey: string;
  key: EdgeNodeKey;
  warning?: string;
};

type TenantOption = {
  id: string;
  name: string;
};

type TenantOptionsResponse = {
  ok: boolean;
  items: TenantOption[];
};

type EdgeNodeForm = {
  code: string;
  name: string;
  status: string;
  tenantId: string;
  appVersion: string;
};

const emptyForm: EdgeNodeForm = {
  code: '',
  name: '',
  status: 'ACTIVE',
  tenantId: '',
  appVersion: '',
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

function activeKeyCount(keys: EdgeNodeKey[]) {
  return keys.filter((key) => key.isActive && !key.revokedAt).length;
}

function statusClassName(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'INACTIVE') return 'bg-slate-100 text-slate-600';
  if (status === 'DELETED') return 'bg-red-50 text-red-700';
  if (status === 'MAINTENANCE') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function toForm(item: EdgeNodeItem): EdgeNodeForm {
  return {
    code: item.code ?? '',
    name: item.name ?? '',
    status: item.status ?? 'ACTIVE',
    tenantId: item.tenantId ?? '',
    appVersion: item.appVersion ?? '',
  };
}

export default function AdminEdgeNodesPage() {
  const [items, setItems] = useState<EdgeNodeItem[]>([]);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EdgeNodeItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EdgeNodeForm>(emptyForm);
  const [issuedApiKey, setIssuedApiKey] = useState<{
    edgeNodeCode: string;
    keyId: string;
    apiKey: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [data, tenantData] = await Promise.all([
        apiFetch<EdgeNodesResponse>('/edge-nodes'),
        apiFetch<TenantOptionsResponse>('/edge-nodes/options/tenants'),
      ]);

      setItems(data.items ?? []);
      setTenantOptions(tenantData.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edge 노드 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalActiveKeys = useMemo(
    () => items.reduce((sum, item) => sum + activeKeyCount(item.keys ?? []), 0),
    [items],
  );

  const activeNodeCount = useMemo(
    () => items.filter((item) => item.status === 'ACTIVE').length,
    [items],
  );

  const filteredTenantOptions = useMemo(() => {
    const keyword = tenantSearch.trim().toLowerCase();

    if (!keyword) return tenantOptions;

    return tenantOptions.filter((tenant) => {
      return (
        tenant.name.toLowerCase().includes(keyword) ||
        tenant.id.toLowerCase().includes(keyword)
      );
    });
  }, [tenantOptions, tenantSearch]);

  function openCreateForm() {
    setEditingItem(null);
    setForm(emptyForm);
    setTenantSearch('');
    setFormOpen(true);
    setIssuedApiKey(null);
    setError(null);
  }

  function openEditForm(item: EdgeNodeItem) {
    setEditingItem(item);
    setForm(toForm(item));
    setTenantSearch(item.tenantName ?? item.tenantId ?? '');
    setFormOpen(true);
    setIssuedApiKey(null);
    setError(null);
  }

  function closeForm() {
    setEditingItem(null);
    setForm(emptyForm);
    setTenantSearch('');
    setFormOpen(false);
    setSaving(false);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.code.trim()) {
      setError('Edge 코드를 입력하세요.');
      return;
    }

    if (!form.name.trim()) {
      setError('Edge 이름을 입력하세요.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      status: form.status,
      tenantId: form.tenantId.trim() || null,
      appVersion: form.appVersion.trim() || null,
    };

    try {
      if (editingItem) {
        await apiFetch<EdgeNodeResponse>(`/edge-nodes/${editingItem.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<EdgeNodeResponse>('/edge-nodes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edge 노드 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteNode(item: EdgeNodeItem) {
    if (
      !confirm(
        `${item.name} 노드를 삭제 처리할까요?\n\n실제 DB row는 보존하고 status=DELETED로 변경하며 활성 API Key를 폐기합니다.`,
      )
    ) {
      return;
    }

    setError(null);

    try {
      await apiFetch<EdgeNodeResponse>(`/edge-nodes/${item.id}`, {
        method: 'DELETE',
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edge 노드 삭제 처리에 실패했습니다.');
    }
  }

  async function issueKey(item: EdgeNodeItem) {
    if (!confirm(`${item.name} API Key를 새로 발급할까요? 키 원문은 한 번만 표시됩니다.`)) {
      return;
    }

    setIssuingId(item.id);
    setError(null);
    setIssuedApiKey(null);

    try {
      const data = await apiFetch<IssueKeyResponse>(`/edge-nodes/${item.id}/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      setIssuedApiKey({
        edgeNodeCode: item.code,
        keyId: data.key.keyId,
        apiKey: data.apiKey,
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API Key 발급에 실패했습니다.');
    } finally {
      setIssuingId(null);
    }
  }

  async function revokeKey(item: EdgeNodeItem, key: EdgeNodeKey) {
    if (!confirm(`${item.name} / ${key.keyId} 키를 폐기할까요?`)) {
      return;
    }

    setError(null);

    try {
      await apiFetch(`/edge-nodes/${item.id}/keys/${encodeURIComponent(key.keyId)}/revoke`, {
        method: 'POST',
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API Key 폐기에 실패했습니다.');
    }
  }

  const isFormOpen = formOpen;

  return (
    <main className="min-h-screen bg-slate-50 px-8 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Cloud Admin</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Edge 관리</h1>
            <p className="mt-2 text-sm text-slate-600">
              Edge 노드, API Key, 담당 Manager, 주차장 연결 상태를 관리합니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-slate-100 px-4 py-3">
                <div className="text-slate-500">전체 노드</div>
                <div className="text-xl font-bold">{items.length}</div>
              </div>
              <div className="rounded-xl bg-slate-100 px-4 py-3">
                <div className="text-slate-500">활성 노드</div>
                <div className="text-xl font-bold">{activeNodeCount}</div>
              </div>
              <div className="rounded-xl bg-slate-100 px-4 py-3">
                <div className="text-slate-500">활성 키</div>
                <div className="text-xl font-bold">{totalActiveKeys}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Edge 노드 추가
            </button>
          </div>
        </header>

        {isFormOpen ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  {editingItem ? 'Edge 노드 수정' : 'Edge 노드 추가'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Tenant는 이름으로 검색해 선택할 수 있으며, 비워두면 미지정 상태로 저장됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <form onSubmit={submitForm} className="grid gap-4 md:grid-cols-5">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">코드</span>
                <input
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                  placeholder="EDGE-DEV-001"
                />
              </label>

              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium text-slate-600">이름</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                  placeholder="KOSMOS Edge 개발 노드"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">상태</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="DELETED">DELETED</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">버전</span>
                <input
                  value={form.appVersion}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, appVersion: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                  placeholder="1.0.0"
                />
              </label>

              <label className="grid gap-1 text-sm md:col-span-4">
                <span className="font-medium text-slate-600">Tenant</span>
                <input
                  value={tenantSearch}
                  onChange={(event) => setTenantSearch(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                  placeholder="Tenant 이름 또는 ID 검색"
                />

                <select
                  value={form.tenantId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, tenantId: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                >
                  <option value="">Tenant 미지정</option>
                  {filteredTenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} / {tenant.id}
                    </option>
                  ))}
                </select>

                {form.tenantId ? (
                  <span className="text-xs text-slate-400">선택된 Tenant ID: {form.tenantId}</span>
                ) : (
                  <span className="text-xs text-slate-400">Tenant를 비워두면 미지정 상태로 저장됩니다.</span>
                )}
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : editingItem ? '수정 저장' : '추가'}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {issuedApiKey ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
            <div className="font-semibold">API Key가 발급되었습니다. 이 값은 한 번만 표시됩니다.</div>
            <div className="mt-3 grid gap-2">
              <div>Edge: {issuedApiKey.edgeNodeCode}</div>
              <div>Key ID: {issuedApiKey.keyId}</div>
              <pre className="overflow-x-auto rounded-xl bg-white p-3 text-xs">{issuedApiKey.apiKey}</pre>
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-semibold">Edge 노드 목록</h2>
              <p className="mt-1 text-xs text-slate-500">
                담당 Manager는 EdgeNode에 연결된 주차장을 기준으로 자동 계산됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-sm text-slate-500">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-sm text-slate-500">등록된 Edge 노드가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Edge</th>
                    <th className="px-5 py-3">상태</th>
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3">주차장</th>
                    <th className="px-5 py-3">담당 Manager</th>
                    <th className="px-5 py-3">API Key</th>
                    <th className="px-5 py-3">최근 연결</th>
                    <th className="px-5 py-3">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const activeKeys = item.keys.filter((key) => key.isActive && !key.revokedAt);
                    const managers = item.managers ?? [];

                    return (
                      <tr key={item.id} className="align-top">
                        <td className="px-5 py-4">
                          <div className="font-semibold">{item.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.code}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.id}</div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassName(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div>{item.tenantName ?? '-'}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.tenantId ?? ''}</div>
                        </td>

                        <td className="px-5 py-4">
                          {item.parkingLots.length ? (
                            <div className="space-y-1">
                              {item.parkingLots.map((link) => (
                                <div key={link.id} className="text-xs">
                                  <span className="font-medium">
                                    {link.parkingLot?.name ?? link.parkingLotId}
                                  </span>
                                  {link.isPrimary ? (
                                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                                      Primary
                                    </span>
                                  ) : null}
                                  <div className="text-slate-400">{link.parkingLot?.code}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {managers.length ? (
                            <div className="space-y-2">
                              {managers.map((manager) => (
                                <div key={manager.userId} className="text-xs">
                                  <div className="font-medium">{manager.name}</div>
                                  <div className="text-slate-500">{manager.email ?? '-'}</div>
                                  <div className="text-slate-400">
                                    담당 주차장 {manager.parkingLotIds?.length ?? 0}개
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">매칭된 Manager 없음</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium">{activeKeys.length}개 활성</div>
                          <div className="mt-2 space-y-1">
                            {item.keys.slice(0, 3).map((key) => (
                              <div key={key.id} className="flex items-center gap-2 text-xs">
                                <span
                                  className={
                                    key.isActive && !key.revokedAt
                                      ? 'text-emerald-700'
                                      : 'text-slate-400'
                                  }
                                >
                                  {key.keyId}
                                </span>
                                {key.isActive && !key.revokedAt ? (
                                  <button
                                    type="button"
                                    onClick={() => void revokeKey(item, key)}
                                    className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                                  >
                                    폐기
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-xs">Seen: {formatDate(item.lastSeenAt)}</div>
                          <div className="mt-1 text-xs">
                            Connected: {formatDate(item.lastConnectedAt)}
                          </div>
                          <div className="mt-1 text-xs">Sync: {formatDate(item.lastSyncAt)}</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            <a
                              href={`/admin/edge-nodes/${item.id}`}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-center text-xs font-medium hover:bg-slate-50"
                            >
                              상세/연결
                            </a>

                            <button
                              type="button"
                              onClick={() => openEditForm(item)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50"
                            >
                              수정
                            </button>

                            <button
                              type="button"
                              disabled={issuingId === item.id || item.status === 'DELETED'}
                              onClick={() => void issueKey(item)}
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              {issuingId === item.id ? '발급 중...' : 'API Key 발급'}
                            </button>

                            <button
                              type="button"
                              disabled={item.status === 'DELETED'}
                              onClick={() => void deleteNode(item)}
                              className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
