'use client';

import ParkingLotRegionFilter from '@/features/facilities/components/parking-lot-region-filter';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';
import type { ConsoleRole } from '@/lib/console-role';
import { canManageBilling } from '@/lib/console-role';
import { PERMISSIONS } from '@/lib/rbac/permissions';

type Props = {
  role?: ConsoleRole;
};

type ParkingLot = {
  id: string;
  name: string;
  code?: string | null;
};

type FeePolicy = {
  id: string;
  parkingLotId: string;
  parkingLot?: ParkingLot | null;
  code?: string | null;
  name?: string | null;
  vehicleType: string;
  baseMinutes: number;
  baseFee: number;
  unitMinutes: number;
  unitFee: number;
  dailyMax?: number | null;
  graceMinutes?: number;
  exitGraceMinutes?: number;
  registrationGraceMinutes?: number;
  registrationGraceFee?: number;
  registrationGraceDiscountEnabled?: boolean;
  authorityRegistrationGraceDiscountEnabled?: boolean;
  watcherRewardGraceFeeEnabled?: boolean;
  memberDiscountPercent?: number;
  isActive: boolean;
};

const VEHICLE_TYPES = ['CAR', 'TRUCK', 'BUS', 'MOTORCYCLE'];

const initialForm = {
  parkingLotId: '',
  code: '',
  name: '',
  vehicleType: 'CAR',
  baseMinutes: 30,
  baseFee: 1000,
  unitMinutes: 10,
  unitFee: 500,
  dailyMax: 15000,
  graceMinutes: 0,
  exitGraceMinutes: 10,
  registrationGraceMinutes: 10,
  registrationGraceFee: 1000,
  registrationGraceDiscountEnabled: true,
  authorityRegistrationGraceDiscountEnabled: false,
  watcherRewardGraceFeeEnabled: true,
  memberDiscountPercent: 0,
  isActive: true,
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return `₩${Number(value).toLocaleString()}`;
}

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;

  if (value && typeof value === 'object') {
    const obj = value as {
      data?: unknown;
      items?: unknown;
    };

    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }

  return [];
}

function getParkingLotName(item: FeePolicy, parkingLots: ParkingLot[]) {
  return (
    item.parkingLot?.name ??
    parkingLots.find((lot) => lot.id === item.parkingLotId)?.name ??
    '-'
  );
}

function getPolicyName(item: FeePolicy) {
  return item.name || item.code || item.id;
}

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Array.isArray(permissions) && permissions.includes(permission);
}

export default function FeePoliciesPage({ role = 'admin' }: Props) {
  const { session, user, isReady } = useAuth();

  const [parkingLotId, setParkingLotId] = useState('');
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [items, setItems] = useState<FeePolicy[]>([]);
  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const accessToken = session?.accessToken;

  const canManage = useMemo(() => {
    if (!canManageBilling(role)) return false;

    return (
      user?.permissions?.includes(PERMISSIONS.BILLING_FEE_POLICY_MANAGE) ??
      false
    );
  }, [role, user?.permissions]);

  const canSubmit = useMemo(() => {
    return Boolean(
      form.parkingLotId &&
        form.name.trim() &&
        form.vehicleType &&
        form.baseMinutes > 0 &&
        form.baseFee >= 0 &&
        form.unitMinutes > 0 &&
        form.unitFee >= 0,
    );
  }, [form]);

  async function loadParkingLots() {
    if (!accessToken) return;

    try {
      const data = await apiFetch('/facilities/lots', {
        accessToken,
      });

      setParkingLots(unwrapList<ParkingLot>(data));
    } catch {
      setParkingLots([]);
    }
  }

  async function load() {
    if (!accessToken) {
      setError('로그인 세션이 없습니다. 다시 로그인하세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const query = parkingLotId
        ? `/billing/fee-policies?parkingLotId=${encodeURIComponent(parkingLotId)}`
        : '/billing/fee-policies';

      const data = await apiFetch(query, {
        accessToken,
      });

      setItems(unwrapList<FeePolicy>(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : '요금 정책을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady || !accessToken) return;

    void loadParkingLots();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, accessToken]);

  async function createPolicy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canManage) return;

    if (!accessToken) {
      setError('로그인 세션이 없습니다. 다시 로그인하세요.');
      return;
    }

    if (!canSubmit) return;

    setSaving(true);
    setError('');

    try {
      await apiFetch('/billing/fee-policies', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          parkingLotId: form.parkingLotId,
          code: form.code.trim() || null,
          name: form.name.trim(),
          vehicleType: form.vehicleType,
          baseMinutes: Number(form.baseMinutes),
          baseFee: Number(form.baseFee),
          unitMinutes: Number(form.unitMinutes),
          unitFee: Number(form.unitFee),
          dailyMax: form.dailyMax === null ? null : Number(form.dailyMax),
          graceMinutes: Number(form.graceMinutes),
          exitGraceMinutes: Number(form.exitGraceMinutes),
          registrationGraceMinutes: Number(form.registrationGraceMinutes),
          registrationGraceFee: Number(form.registrationGraceFee),
          registrationGraceDiscountEnabled: Boolean(form.registrationGraceDiscountEnabled),
          authorityRegistrationGraceDiscountEnabled: Boolean(form.authorityRegistrationGraceDiscountEnabled),
          watcherRewardGraceFeeEnabled: Boolean(form.watcherRewardGraceFeeEnabled),
          memberDiscountPercent: Number(form.memberDiscountPercent),
          isActive: Boolean(form.isActive),
        }),
      });

      setParkingLotId(form.parkingLotId);
      setForm(initialForm);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '요금 정책을 등록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="w-full max-w-none space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            요금 정책
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            주차장별 요금 정책 목록 조회
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!canManage ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              조회 전용
            </span>
          ) : null}

          {canManage ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              요금 등록
            </button>
          ) : null}
        </div>
      </div>

      <ParkingLotRegionFilter
        parkingLotId={parkingLotId}
        onChange={(next) => {
          setParkingLotId(next.parkingLotId);
        }}
      />

      <section className="flex flex-wrap items-center gap-2 rounded-3xl border bg-white p-4">
        <button
          type="button"
          onClick={load}
          className="rounded-2xl border px-4 py-3 text-sm font-medium hover:bg-slate-50"
        >
          조회
        </button>
      </section>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">번호</th>
              <th className="px-4 py-3 font-medium">주차장</th>
              <th className="px-4 py-3 font-medium">정책명</th>
              <th className="px-4 py-3 font-medium">차량 유형</th>
              <th className="px-4 py-3 font-medium">기본 요금</th>
              <th className="px-4 py-3 font-medium">단위 요금</th>
              <th className="px-4 py-3 font-medium">일일 최대 요금</th>
              <th className="px-4 py-3 font-medium">무료 회차</th>
              <th className="px-4 py-3 font-medium">결제 후 유예</th>
              <th className="px-4 py-3 font-medium">직접 등록 할인</th>
              <th className="px-4 py-3 font-medium">직권/Watcher</th>
              <th className="px-4 py-3 font-medium">할인</th>
              <th className="px-4 py-3 font-medium">상태</th>
              {canManage ? (
                <th className="px-4 py-3 font-medium">관리</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={canManage ? 14 : 13}>
                  불러오는 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={canManage ? 14 : 13}
                >
                  등록된 요금 정책이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">{getParkingLotName(item, parkingLots)}</td>
                  <td className="px-4 py-3">{getPolicyName(item)}</td>
                  <td className="px-4 py-3">{item.vehicleType}</td>
                  <td className="px-4 py-3">
                    {item.baseMinutes}분 / {formatCurrency(item.baseFee)}
                  </td>
                  <td className="px-4 py-3">
                    {item.unitMinutes}분 / {formatCurrency(item.unitFee)}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(item.dailyMax)}</td>
                  <td className="px-4 py-3">{item.graceMinutes ?? 0}분</td>
                  <td className="px-4 py-3">{item.exitGraceMinutes ?? 10}분</td>
                  <td className="px-4 py-3">
                    <div className="text-xs leading-5">
                      <div>
                        {(item.registrationGraceDiscountEnabled ?? true)
                          ? '사용'
                          : '미사용'}
                      </div>
                      <div>
                        {item.registrationGraceMinutes ?? 10}분 / {formatCurrency(item.registrationGraceFee ?? 0)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs leading-5">
                      <div>
                        직권 할인:{' '}
                        {item.authorityRegistrationGraceDiscountEnabled
                          ? '사용'
                          : '미사용'}
                      </div>
                      <div>
                        Watcher 보상:{' '}
                        {item.watcherRewardGraceFeeEnabled ? '사용' : '미사용'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.memberDiscountPercent ?? 0}%
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        item.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.isActive ? '사용' : '미사용'}
                    </span>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded-xl border px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        수정
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {modalOpen && canManage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  요금 등록
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  주차장별 요금 정책을 등록합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={createPolicy}>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  주차장
                </label>
                <select
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.parkingLotId}
                  onChange={(e) =>
                    setForm({ ...form, parkingLotId: e.target.value })
                  }
                  required
                >
                  <option value="">주차장을 선택하세요</option>
                  {parkingLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  정책 코드
                </label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="CAR_DEFAULT"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  정책명
                </label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Default Car Fee"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  차량 유형
                </label>
                <select
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.vehicleType}
                  onChange={(e) =>
                    setForm({ ...form, vehicleType: e.target.value })
                  }
                >
                  {VEHICLE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <NumberField
                label="Base Minutes"
                value={form.baseMinutes}
                onChange={(value) => setForm({ ...form, baseMinutes: value })}
              />

              <NumberField
                label="기본 요금"
                value={form.baseFee}
                onChange={(value) => setForm({ ...form, baseFee: value })}
              />

              <NumberField
                label="Unit Minutes"
                value={form.unitMinutes}
                onChange={(value) => setForm({ ...form, unitMinutes: value })}
              />

              <NumberField
                label="단위 요금"
                value={form.unitFee}
                onChange={(value) => setForm({ ...form, unitFee: value })}
              />

              <NumberField
                label="일일 최대 요금"
                value={form.dailyMax}
                onChange={(value) => setForm({ ...form, dailyMax: value })}
              />

              <NumberField
                label="무료 회차 시간(분)"
                value={form.graceMinutes}
                onChange={(value) => setForm({ ...form, graceMinutes: value })}
              />

              <NumberField
                label="결제 후 출차 유예(분)"
                value={form.exitGraceMinutes}
                onChange={(value) =>
                  setForm({ ...form, exitGraceMinutes: value })
                }
              />

              <NumberField
                label="Member Discount %"
                value={form.memberDiscountPercent}
                onChange={(value) =>
                  setForm({ ...form, memberDiscountPercent: value })
                }
              />

              <label className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                Active
              </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">
                      직접 등록 할인 시간
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={form.registrationGraceMinutes}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          registrationGraceMinutes: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">
                      직접 등록 할인 금액
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={form.registrationGraceFee}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          registrationGraceFee: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.registrationGraceDiscountEnabled}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          registrationGraceDiscountEnabled: event.target.checked,
                        }))
                      }
                    />
                    직접 등록 할인 사용
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.authorityRegistrationGraceDiscountEnabled}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          authorityRegistrationGraceDiscountEnabled:
                            event.target.checked,
                        }))
                      }
                    />
                    직권 등록 할인 사용
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.watcherRewardGraceFeeEnabled}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          watcherRewardGraceFeeEnabled: event.target.checked,
                        }))
                      }
                    />
                    Watcher 보상 기준 사용
                  </label>

              <div className="flex justify-end gap-2 pt-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}