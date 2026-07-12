'use client';

import ParkingLotRegionFilter from '../components/parking-lot-region-filter';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PaginationBar } from '@/components/console/pagination-bar';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
  parseTableQueryFromSearchParams,
  unwrapItems,
} from '@/lib/table-query';

type Role = 'admin' | 'manager' | 'operator';

type Props = {
  role?: Role;
};

type ParkingLot = {
  id: string;
  name: string;
  code?: string | null;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  isActive?: boolean | null;
};

type ParkingSpace = {
  id: string;
  code?: string | null;
  name?: string | null;
  status?: string | null;
};

type ParkingSection = {
  id: string;
  name: string;
  code?: string | null;
  parkingLotId?: string | null;
  parkingLot?: ParkingLot | null;
  spaces?: ParkingSpace[];
  _count?: {
    spaces?: number;
  };
};

type SectionForm = {
  id: string;
  name: string;
  code: string;
  region: string;
  parkingLotId: string;
};

type RequestForm = {
  region: string;
  parkingLotId: string;
  sectionId: string;
};

function getLoginPath(role: Role) {
  if (role === 'admin') return '/admin/login';
  if (role === 'manager') return '/manager/login';
  return '/operator/login';
}

function emptyForm(): SectionForm {
  return {
    id: '',
    name: '',
    code: '',
    region: '',
    parkingLotId: '',
  };
}

function emptyRequestForm(): RequestForm {
  return {
    region: '',
    parkingLotId: '',
    sectionId: '',
  };
}

export default function SectionsPage({ role = 'admin' }: Props) {
  const canManage = role === 'admin' || role === 'manager';
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedLotId = searchParams.get('lotId') ?? '';
  const { session, logout } = useAuth();

  const [items, setItems] = useState<ParkingSection[]>([]);
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const selectedLot = useMemo(() => {
    if (!selectedLotId) return null;
    return lots.find((lot: any) => lot.id === selectedLotId) ?? null;
  }, [lots, selectedLotId]);
  const [lotFilter, setLotFilter] = useState({ region: '', district: '', parkingLotId: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ParkingSection | null>(null);
  const [form, setForm] = useState<SectionForm>(emptyForm());

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] =
    useState<RequestForm>(emptyRequestForm());
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const basePath =
    role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : '/operator';

  const query = useMemo(
    () => parseTableQueryFromSearchParams(searchParams),
    [searchParams],
  );

  const regions = useMemo(() => {
    return Array.from(
      new Set(lots.map((lot) => lot.region).filter(Boolean) as string[]),
    ).sort();
  }, [lots]);

  const filteredLots = useMemo(() => {
    if (!form.region) return lots;
    return lots.filter((lot) => lot.region === form.region);
  }, [lots, form.region]);

  const requestLots = useMemo(() => {
    if (!requestForm.region) return lots;
    return lots.filter((lot) => lot.region === requestForm.region);
  }, [lots, requestForm.region]);

  const requestSections = useMemo(() => {
    return items.filter((section) => {
      const lotId = section.parkingLotId ?? section.parkingLot?.id;
      if (requestForm.parkingLotId && lotId !== requestForm.parkingLotId) {
        return false;
      }

      if (requestForm.region) {
        const lot = section.parkingLot ?? lots.find((item) => item.id === lotId);
        if (lot?.region !== requestForm.region) return false;
      }

      return true;
    });
  }, [items, lots, requestForm.parkingLotId, requestForm.region]);

  const filteredItems = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    return items.filter((item) => {
      const row = item as any;
      if (selectedLotId) {
        const itemLotId =
          row.parkingLotId ?? row.parkingLot?.id ?? row.lotId ?? '';
        if (itemLotId !== selectedLotId) return false;
      }

      const lot = item.parkingLot ?? lots.find((lotItem) => lotItem.id === item.parkingLotId);
      const lotId = item.parkingLotId ?? lot?.id;

      const selectedParkingLotId = lotFilter.parkingLotId || query.parkingLotId;
      const selectedRegion = lotFilter.region || query.region;
      const selectedDistrict = lotFilter.district;

      if (selectedParkingLotId && lotId !== selectedParkingLotId) return false;
      if (selectedRegion && lot?.region !== selectedRegion) return false;
      if (selectedDistrict && lot?.district !== selectedDistrict) return false;

      if (!keyword) return true;

      return [lot?.region, lot?.name, lot?.code, item.name, item.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, lots, lotFilter.parkingLotId, lotFilter.region, lotFilter.district, query.parkingLotId, query.q, query.region]);

  const meta = useMemo(
    () =>
      createPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        total: filteredItems.length,
      }),
    [filteredItems.length, query.page, query.pageSize],
  );

  const pagedItems = useMemo(
    () => paginateClientSide(filteredItems, meta.page, meta.pageSize),
    [filteredItems, meta.page, meta.pageSize],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [sectionResult, lotResult] = await Promise.all([
        apiFetch('/facilities/sections', {
          accessToken: session.accessToken,
        }),
        apiFetch('/facilities/lots', {
          accessToken: session.accessToken,
        }),
      ]);

      setItems(unwrapItems<ParkingSection>(sectionResult));
      setLots(unwrapItems<ParkingLot>(lotResult));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '구역 목록을 불러오지 못했습니다.';

      if (message.toLowerCase().includes('unauthorized')) {
        logout(getLoginPath(role));
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, logout, role]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateModal() {
    if (!canManage) return;

    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openRequestModal() {
    setRequestForm(emptyRequestForm());
    setRequestMessage(null);
    setRequestOpen(true);
  }

  function openEditModal(item: ParkingSection) {
    if (!canManage) return;

    const lot = item.parkingLot ?? lots.find((x) => x.id === item.parkingLotId);

    setEditing(item);
    setForm({
      id: item.id,
      name: item.name ?? '',
      code: item.code ?? '',
      region: lot?.region ?? '',
      parkingLotId: item.parkingLotId ?? lot?.id ?? '',
    });
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) return;
    if (!canManage) return;

    if (!form.name.trim()) {
      setError('구역명을 입력해 주세요.');
      return;
    }

    if (!form.parkingLotId) {
      setError('Parking lot is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      parkingLotId: form.parkingLotId,
      ...(form.code.trim() ? { code: form.code.trim() } : {}),
    };

    try {
      if (editing) {
        await apiFetch(`/facilities/sections/${editing.id}`, {
          method: 'PATCH',
          accessToken: session.accessToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/facilities/sections', {
          method: 'POST',
          accessToken: session.accessToken,
          body: JSON.stringify(payload),
        });
      }

      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm());
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : '구역 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) return;

    if (!requestForm.sectionId) {
      setRequestMessage('구역을 선택해 주세요.');
      return;
    }

    setRequestSaving(true);
    setRequestMessage(null);

    try {
      await apiFetch('/approvals/operator-sections', {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          parkingLotId: requestForm.parkingLotId,
          sectionId: requestForm.sectionId,
        }),
      });

      setRequestMessage('Request submitted.');
      setRequestOpen(false);
      setRequestForm(emptyRequestForm());
    } catch (error) {
      setRequestMessage(
        error instanceof Error
          ? error.message
          : '구역 권한 요청에 실패했습니다.',
      );
    } finally {
      setRequestSaving(false);
    }
  }

  async function deleteSection(item: ParkingSection) {
    if (!session?.accessToken) return;
    if (!canManage) return;

    const ok = window.confirm(`Delete section "${item.name}"?`);
    if (!ok) return;

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/facilities/sections/${item.id}`, {
        method: 'DELETE',
        accessToken: session.accessToken,
      });

      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : '구역 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function goToSpaces(item: ParkingSection) {
    const lotId = item.parkingLotId ?? item.parkingLot?.id ?? '';
    const params = new URLSearchParams();

    if (lotId) params.set('parkingLotId', lotId);
    params.set('sectionId', item.id);

    router.push(`${basePath}/facilities/spaces?${params.toString()}`);
  }

  return (
    <main className="space-y-6 p-6">
      <ParkingLotRegionFilter
        parkingLotId={lotFilter.parkingLotId || query.parkingLotId}
        onChange={(next) => setLotFilter(next)}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">구역 관리</h1>
          <p className="text-sm text-slate-500">
            {role === 'admin' ? '전체 주차 구역을 관리합니다.' : '권한이 있는 주차 구역을 관리합니다.'}
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            구역 추가
          </button>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            조회 전용
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {requestMessage ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          {requestMessage}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-slate-500">불러오는 중...</div> : null}

      {selectedLotId ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          선택된 주차장: {selectedLot?.name ?? selectedLotId}
          <a
            href={`${basePath}/facilities/sections`}
            className="ml-3 font-semibold underline-offset-2 hover:underline"
          >
            필터 해제
          </a>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-5 py-3">번호</th>
              <th className="px-5 py-3">지역</th>
              <th className="px-5 py-3">주차장</th>
              <th className="px-5 py-3">구역명</th>
              <th className="px-5 py-3">구역 코드</th>
              <th className="px-5 py-3">주차면 수</th>
              {canManage ? (
                <th className="px-5 py-3 text-right">관리</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {pagedItems.map((item, index) => {
              const lot =
                item.parkingLot ??
                lots.find((lotItem) => lotItem.id === item.parkingLotId) ??
                null;

              return (
                <tr key={item.id} className="border-t">
                  <td className="px-5 py-3">
                    {getRowNumber({
                      page: meta.page,
                      pageSize: meta.pageSize,
                      index,
                    })}
                  </td>
                  <td className="px-5 py-3">{lot?.region ?? '-'}</td>
                  <td className="px-5 py-3">{lot?.name ?? '-'}</td>
                  <td className="px-5 py-3">{item.name ?? '-'}</td>
                  <td className="px-5 py-3">{item.code ?? '-'}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => goToSpaces(item)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {item._count?.spaces ?? item.spaces?.length ?? 0}
                    </button>
                  </td>
                  {canManage ? (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="rounded-lg border px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                        >
                            수정
                          </button>
                        <button
                          type="button"
                          onClick={() => void deleteSection(item)}
                          disabled={saving}
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            삭제
                          </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 7 : 6}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  등록된 구역이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationBar meta={meta} />

      {formOpen && canManage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitForm}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5">
              <h2 className="text-lg font-bold">
                {editing ? 'Edit Section' : '구역 추가'}
              </h2>
              <p className="text-sm text-slate-500">
                Select region and parking lot, then enter section information.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">지역</span>
                <select
                  value={form.region}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      region: event.target.value,
                      parkingLotId: '',
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">All regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Parking Lot
                </span>
                <select
                  value={form.parkingLotId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      parkingLotId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select parking lot</option>
                  {filteredLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name} {lot.code ? `(${lot.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">구역명</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Section Code
                </span>
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, code: event.target.value }))
                  }
                  placeholder="Unique inside selected parking lot"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                  setForm(emptyForm());
                }}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {requestOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitRequest}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold">Request Section</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select the section you want to operate.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">지역</span>
                <select
                  value={requestForm.region}
                  onChange={(event) =>
                    setRequestForm({
                      region: event.target.value,
                      parkingLotId: '',
                      sectionId: '',
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">All regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Parking Lot
                </span>
                <select
                  value={requestForm.parkingLotId}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      parkingLotId: event.target.value,
                      sectionId: '',
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select parking lot</option>
                  {requestLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.region ? `[${lot.region}] ` : ''}
                      {lot.name} {lot.code ? `(${lot.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Section</span>
                <select
                  value={requestForm.sectionId}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      sectionId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select section</option>
                  {requestSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} {section.code ? `(${section.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={requestSaving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {requestSaving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
