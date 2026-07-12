'use client';

import ParkingLot지역Filter from '../components/parking-lot-region-filter';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
};

type Parking구역 = {
  id: string;
  name: string;
  code?: string | null;
  parkingLotId?: string | null;
  parkingLot?: ParkingLot | null;
};

type SensorDevice = {
  id: string;
  name?: string | null;
  type?: string | null;
  serialNumber?: string | null;
  devEui?: string | null;
  status?: string | null;
  parkingSpaceId?: string | null;
  parkingLotId?: string | null;
  parking구역Id?: string | null;
  firmwareVersion?: string | null;
  lastSeenAt?: string | null;
};

type ParkingSpaceItem = {
  id: string;
  code?: string | null;
  number?: string | null;
  type?: string | null;
  status?: string | null;
  sectionId?: string | null;
  section?: Parking구역 | null;
  sensorDevice?: SensorDevice | null;
  device?: SensorDevice | null;
  sensor?: SensorDevice | null;
};

type SpaceForm = {
  region: string;
  parkingLotId: string;
  sectionId: string;
  codeSuffix: string;
  type: string;
};

type SensorForm = {
  type: string;
  devEui: string;
  serialNumber: string;
};

function emptyForm(): SpaceForm {
  return {
    region: '',
    parkingLotId: '',
    sectionId: '',
    codeSuffix: '',
    type: 'REGULAR',
  };
}

function emptySensorForm(): SensorForm {
  return {
    type: 'PARKING_SENSOR',
    devEui: '',
    serialNumber: '',
  };
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function strip구역Prefix(code: string, section코드?: string | null) {
  if (!section코드) return code;

  const prefix = `${section코드}-`;

  if (code.startsWith(prefix)) {
    return code.slice(prefix.length);
  }

  return code;
}

function formatSpaceType(value?: string | null) {
  if (!value) return '-';

  const labels: Record<string, string> = {
    REGULAR: '일반',
    HANDICAP: '장애인',
    COMPACT: '경차',
    ELECTRIC: '전기차',
    DISABLED: '장애인',
    EV: '전기차',
    VIP: 'VIP',
  };

  return labels[value] ?? value;
}

function formatSpaceStatus(value?: string | null) {
  if (!value) return '-';

  const labels: Record<string, string> = {
    EMPTY: '출차',
    OCCUPIED: '입차',
    OCCUPIED_UNREGISTERED: '입차 · 미등록',
    RESERVED: '예약',
    DISABLED: '비활성',
    MAINTENANCE: '점검',
  };

  return labels[value] ?? value;
}

function formatDeviceStatus(value?: string | null) {
  if (!value) return '-';

  const labels: Record<string, string> = {
    ACTIVE: '활성',
    INACTIVE: '비활성',
    ONLINE: '온라인',
    OFFLINE: '오프라인',
    ERROR: '오류',
  };

  return labels[value] ?? value;
}

export default function SpacesPage({ role = 'admin' }: Props) {
  const searchParams = useSearchParams();
  const selectedParkingLotId = searchParams.get('parkingLotId') ?? '';
  const selected구역Id = searchParams.get('sectionId') ?? '';
  const canManage = role === 'admin' || role === 'manager';
  const basePath =
    role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : '/operator';
  const { session } = useAuth();

  const [items, setItems] = useState<ParkingSpaceItem[]>([]);
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [lotFilter, setLotFilter] = useState({ region: '', district: '', parkingLotId: '' });
  const [sections, set구역s] = useState<Parking구역[]>([]);

  const querySelected구역 = useMemo(() => {
    if (!selected구역Id) return null;
    return sections.find((section: any) => section.id === selected구역Id) ?? null;
  }, [sections, selected구역Id]);

  const querySelectedLot = useMemo(() => {
    if (!selectedParkingLotId) return null;
    return lots.find((lot: any) => lot.id === selectedParkingLotId) ?? null;
  }, [lots, selectedParkingLotId]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ParkingSpaceItem | null>(null);
  const [form, setForm] = useState<SpaceForm>(emptyForm());

  const [sensorModalOpen, setSensorModalOpen] = useState(false);
  const [sensorTargetSpace, setSensorTargetSpace] =
    useState<ParkingSpaceItem | null>(null);
  const [sensorForm, setSensorForm] = useState<SensorForm>(emptySensorForm());

  const [sensorDetailOpen, setSensorDetailOpen] = useState(false);
  const [sensorDetail, setSensorDetail] = useState<SensorDevice | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

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

  const filteredSections = useMemo(() => {
    return sections.filter((section) => {
      const lotId = section.parkingLotId ?? section.parkingLot?.id;

      if (form.parkingLotId && lotId !== form.parkingLotId) {
        return false;
      }

      if (form.region) {
        const lot = section.parkingLot ?? lots.find((item) => item.id === lotId);
        if (lot?.region !== form.region) return false;
      }

      return true;
    });
  }, [sections, lots, form.parkingLotId, form.region]);

  const selected구역 = useMemo(() => {
    return sections.find((section) => section.id === form.sectionId) ?? null;
  }, [sections, form.sectionId]);

  const selected구역코드 = selected구역?.code?.trim() ?? '';
  const codePrefix = selected구역코드 ? `${selected구역코드}-` : '';

  const filteredItems = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    return items.filter((item) => {
      const section =
        item.section ?? sections.find((sectionItem) => sectionItem.id === item.sectionId) ?? null;

      const lot =
        section?.parkingLot ??
        lots.find((lotItem) => lotItem.id === section?.parkingLotId) ??
        null;

      const lotId = section?.parkingLotId ?? lot?.id;

      const activeParkingLotId =
        lotFilter.parkingLotId || query.parkingLotId || selectedParkingLotId;
      const active구역Id = query.sectionId || selected구역Id;
      const selected지역 = lotFilter.region || query.region;
      const selectedDistrict = lotFilter.district;

      if (activeParkingLotId && lotId !== activeParkingLotId) return false;
      if (active구역Id && section?.id !== active구역Id) return false;
      if (selected지역 && lot?.region !== selected지역) return false;
      if (selectedDistrict && lot?.district !== selectedDistrict) return false;

      if (!keyword) return true;

      const sensorDevice = getSensorDevice(item);

      return [
        lot?.region,
        lot?.name,
        lot?.code,
        section?.name,
        section?.code,
        item.code,
        item.type,
        item.status,
        sensorDevice?.devEui,
        sensorDevice?.serialNumber,
        sensorDevice?.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [
    items,
    lots,
    lotFilter.parkingLotId,
    lotFilter.region,
    lotFilter.district,
    query.parkingLotId,
    query.q,
    query.region,
    query.sectionId,
    sections,
  ]);

  const meta = useMemo(
    () =>
      createPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        total: filteredItems.length,
      }),
    [filteredItems.length, query.page, query.pageSize],
  );

  const rows = useMemo(
    () => paginateClientSide(filteredItems, meta.page, meta.pageSize),
    [filteredItems, meta.page, meta.pageSize],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [spacesResult, lotsResult, sectionsResult] = await Promise.all([
        apiFetch('/facilities/spaces', {
          accessToken: session.accessToken,
        }),
        apiFetch('/facilities/lots', {
          accessToken: session.accessToken,
        }),
        apiFetch('/facilities/sections', {
          accessToken: session.accessToken,
        }),
      ]);

      setItems(unwrapItems<ParkingSpaceItem>(spacesResult));
      setLots(unwrapItems<ParkingLot>(lotsResult));
      set구역s(unwrapItems<Parking구역>(sectionsResult));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '주차면 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateModal() {
    if (!canManage) return;

    setEditing(null);

    const initialLot =
      query.parkingLotId && lots.some((lot) => lot.id === query.parkingLotId)
        ? lots.find((lot) => lot.id === query.parkingLotId)
        : null;

    const initial구역 =
      query.sectionId &&
      sections.some((section) => section.id === query.sectionId)
        ? sections.find((section) => section.id === query.sectionId)
        : null;

    setForm({
      ...emptyForm(),
      region: initialLot?.region ?? initial구역?.parkingLot?.region ?? '',
      parkingLotId:
        initialLot?.id ??
        initial구역?.parkingLotId ??
        initial구역?.parkingLot?.id ??
        '',
      sectionId: initial구역?.id ?? '',
    });

    setFormOpen(true);
  }

  function openEditModal(item: ParkingSpaceItem) {
    if (!canManage) return;

    const section =
      item.section ??
      sections.find((sectionItem) => sectionItem.id === item.sectionId);

    const parkingLotId = section?.parkingLotId ?? section?.parkingLot?.id ?? '';
    const lot = lots.find((lotItem) => lotItem.id === parkingLotId);
    const code = item.code ?? '';

    setEditing(item);
    setForm({
      region: lot?.region ?? section?.parkingLot?.region ?? '',
      parkingLotId,
      sectionId: item.sectionId ?? section?.id ?? '',
      codeSuffix: strip구역Prefix(code, section?.code),
      type: item.type ?? '일반',
    });
    setFormOpen(true);
  }

  function openSensorModal(item: ParkingSpaceItem) {
    if (!canManage) return;

    setSensorTargetSpace(item);
    setSensorForm({
      type: 'PARKING_SENSOR',
      devEui: '',
      serialNumber: item.code ? `SENSOR-${item.code}` : '',
    });
    setSensorModalOpen(true);
    setError(null);
  }

  function openSensorDetailModal(sensorDevice: SensorDevice) {
    setSensorDetail(sensorDevice);
    setSensorDetailOpen(true);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) return;
    if (!canManage) return;

    const suffix = form.codeSuffix.trim();

    if (!suffix) {
      setError('Space code is required.');
      return;
    }

    if (!form.sectionId) {
      setError('구역을 선택해 주세요.');
      return;
    }

    const code = `${codePrefix}${suffix}`;

    setSaving(true);
    setError(null);

    const payload = {
      code,
      type: form.type,
      sectionId: form.sectionId,
    };

    try {
      if (editing) {
        await apiFetch(`/facilities/spaces/${editing.id}`, {
          method: 'PATCH',
          accessToken: session.accessToken,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/facilities/spaces', {
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
      setError(
        error instanceof Error ? error.message : '주차면 저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitSensorForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken || !sensorTargetSpace) return;
    if (!canManage) return;

    const devEui = sensorForm.devEui.trim().toLowerCase();

    if (!devEui) {
      setError('DevEUI is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      type: sensorForm.type,
      devEui,
      serialNumber: sensorForm.serialNumber.trim() || `SENSOR-${devEui}`,
      name: sensorTargetSpace.code
        ? `Sensor ${sensorTargetSpace.code}`
        : `Sensor ${devEui}`,
      parkingSpaceId: sensorTargetSpace.id,
    };

    try {
      try {
        await apiFetch('/devices/sensors', {
          method: 'POST',
          accessToken: session.accessToken,
          body: JSON.stringify(payload),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to register sensor device.';

        const shouldReplace = window.confirm(
          `${message}\n\nDo you want to replace the existing sensor mapping for this parking space?`,
        );

        if (!shouldReplace) {
          throw error;
        }

        await apiFetch('/devices/sensors/replace', {
          method: 'POST',
          accessToken: session.accessToken,
          body: JSON.stringify(payload),
        });
      }

      setSensorModalOpen(false);
      setSensorTargetSpace(null);
      setSensorForm(emptySensorForm());
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to register sensor device.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteSpace(item: ParkingSpaceItem) {
    if (!session?.accessToken) return;
    if (!canManage) return;

    const ok = window.confirm(`삭제 parking space "${item.code}"?`);
    if (!ok) return;

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/facilities/spaces/${item.id}`, {
        method: 'DELETE',
        accessToken: session.accessToken,
      });

      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '주차면 삭제에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }

  function getSensorDevice(item: ParkingSpaceItem): SensorDevice | null {
    return item.sensorDevice ?? item.device ?? item.sensor ?? null;
  }

  function getSection(item: ParkingSpaceItem) {
    return (
      item.section ??
      sections.find((sectionItem) => sectionItem.id === item.sectionId) ??
      null
    );
  }

  function getLotForSection(section: Parking구역 | null) {
    if (!section) return null;

    return (
      section.parkingLot ??
      lots.find((lotItem) => lotItem.id === section.parkingLotId) ??
      null
    );
  }

  return (
    <main className="space-y-6 p-6">
      <ParkingLot지역Filter
        parkingLotId={lotFilter.parkingLotId || query.parkingLotId}
        onChange={(next) => setLotFilter(next)}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">주차면 관리</h1>
          <p className="text-sm text-slate-500">
            {role === 'admin'
              ? '전체 주차면 및 센서 매핑을 관리합니다.'
              : '권한이 있는 주차면을 관리합니다.'}
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            주차면 추가
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

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      {selectedParkingLotId || selected구역Id ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          선택된 주차장: {querySelectedLot?.name || selectedParkingLotId || '-'}
          {selected구역Id ? (
            <span className="ml-3">
              선택된 구역: {querySelected구역?.name ?? selected구역Id}
            </span>
          ) : null}
          <a
            href={`${basePath}/facilities/spaces`}
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
              <th className="px-5 py-3">구역</th>
              <th className="px-5 py-3">코드</th>
              <th className="px-5 py-3">유형</th>
              <th className="px-5 py-3">센서 장치</th>
              <th className="px-5 py-3">장치 상태</th>
              <th className="px-5 py-3">주차면 상태</th>
              {canManage ? (
                <th className="px-5 py-3 text-right">관리</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {rows.map((item, index) => {
              const sensorDevice = getSensorDevice(item);
              const section = getSection(item);
              const lot = getLotForSection(section);

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
                  <td className="px-5 py-3">{section?.name ?? '-'}</td>
                  <td className="px-5 py-3 font-medium">{item.code ?? '-'}</td>
                  <td className="px-5 py-3">{formatSpaceType(item.type)}</td>
                  <td className="px-5 py-3">
                    {sensorDevice ? (
                      <button
                        type="button"
                        onClick={() => openSensorDetailModal(sensorDevice)}
                        className="text-left font-medium text-blue-600 hover:underline"
                      >
                        {sensorDevice.devEui ??
                          sensorDevice.serialNumber ??
                          sensorDevice.name ??
                          '-'}
                      </button>
                    ) : canManage ? (
                      <button
                        type="button"
                        onClick={() => openSensorModal(item)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        센서 장치 추가
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-5 py-3">{formatDeviceStatus(sensorDevice?.status)}</td>
                  <td className="px-5 py-3">{formatSpaceStatus(item.status)}</td>
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
                          onClick={() => void deleteSpace(item)}
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
                  colSpan={canManage ? 10 : 9}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  등록된 주차면이 없습니다.
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
                {editing ? '주차면 수정' : '주차면 추가'}
              </h2>
              <p className="text-sm text-slate-500">
                Select region, parking lot, and section. Space code is created
                from the section code prefix.
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
                      sectionId: '',
                      codeSuffix: '',
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">전체 지역</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  주차장
                </span>
                <select
                  value={form.parkingLotId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      parkingLotId: event.target.value,
                      sectionId: '',
                      codeSuffix: '',
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">주차장 선택</option>
                  {filteredLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.region ? `[${lot.region}] ` : ''}
                      {lot.name} {lot.code ? `(${lot.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  구역
                </span>
                <select
                  value={form.sectionId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sectionId: event.target.value,
                      codeSuffix: '',
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">구역 선택</option>
                  {filteredSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} {section.code ? `(${section.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  주차면 코드
                </span>
                <div className="mt-1 flex overflow-hidden rounded-xl border focus-within:border-blue-500">
                  <span className="flex items-center border-r bg-slate-50 px-3 text-sm text-slate-500">
                    {codePrefix || '코드-'}
                  </span>
                  <input
                    value={form.codeSuffix}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        codeSuffix: event.target.value,
                      }))
                    }
                    placeholder="123"
                    className="w-full px-3 py-2 text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  최종 코드: {codePrefix}
                  {form.codeSuffix || '___'}
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">유형</span>
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="REGULAR">일반</option>
                  <option value="COMPACT">경차</option>
                  <option value="DISABLED">장애인</option>
                  <option value="EV">전기차</option>
                  <option value="VIP">VIP</option>
                </select>
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
                취소
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : editing ? '수정' : '등록'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sensorModalOpen && canManage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitSensorForm}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5">
              <h2 className="text-lg font-bold">센서 장치 등록</h2>
              <p className="text-sm text-slate-500">
                주차면: {sensorTargetSpace?.code ?? '-'}
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  센서 유형
                </span>
                <select
                  value={sensorForm.type}
                  onChange={(event) =>
                    setSensorForm((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="PARKING_SENSOR">PARKING_SENSOR</option>
                  <option value="SENSIO_CONTROLLER">SENSIO_CONTROLLER</option>
                  <option value="IO_CONTROLLER">IO_CONTROLLER</option>
                  <option value="DISPLAY_BOARD">DISPLAY_BOARD</option>
                  <option value="SMART_TRACKER">SMART_TRACKER</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  DevEUI
                </span>
                <input
                  value={sensorForm.devEui}
                  onChange={(event) =>
                    setSensorForm((prev) => ({
                      ...prev,
                      devEui: event.target.value,
                    }))
                  }
                  placeholder="예: ac1f09fffe1fc97a"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  시리얼 번호
                </span>
                <input
                  value={sensorForm.serialNumber}
                  onChange={(event) =>
                    setSensorForm((prev) => ({
                      ...prev,
                      serialNumber: event.target.value,
                    }))
                  }
                  placeholder="예: SENSOR-A-001"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSensorModalOpen(false);
                  setSensorTargetSpace(null);
                  setSensorForm(emptySensorForm());
                }}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                취소
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '등록 중...' : '센서 등록'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sensorDetailOpen && sensorDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-lg font-bold">센서 장치 상세s</h2>
              <p className="text-sm text-slate-500">
                {sensorDetail.devEui ?? sensorDetail.serialNumber ?? '-'}
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <DetailRow label="Name" value={sensorDetail.name} />
              <DetailRow label="유형" value={sensorDetail.type} />
              <DetailRow label="시리얼 번호" value={sensorDetail.serialNumber} />
              <DetailRow label="DevEUI" value={sensorDetail.devEui} />
              <DetailRow label="상태" value={sensorDetail.status} />
              <DetailRow
                label="주차면 ID"
                value={sensorDetail.parkingSpaceId}
              />
              <DetailRow
                label="주차장 ID"
                value={sensorDetail.parkingLotId}
              />
              <DetailRow
                label="Parking 구역 ID"
                value={sensorDetail.parking구역Id}
              />
              <DetailRow
                label="펌웨어 버전"
                value={sensorDetail.firmwareVersion}
              />
              <DetailRow
                label="최근 수신"
                value={formatDate(sensorDetail.lastSeenAt)}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSensorDetailOpen(false);
                  setSensorDetail(null);
                }}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function getSensorDevice(item: ParkingSpaceItem): SensorDevice | null {
  return item.sensorDevice ?? item.device ?? item.sensor ?? null;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">
        {value ?? '-'}
      </span>
    </div>
  );
}
