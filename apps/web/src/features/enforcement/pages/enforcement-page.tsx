'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';

type Props = {
  role?: ConsoleRole;
};

type EnforcementItem = {
  id: string;
  sessionNo?: string | null;
  status?: string | null;
  entryTime?: string | null;
  elapsedMinutes?: number | null;
  isRegistered?: boolean | null;
  plateNumber?: string | null;
  contactNumber?: string | null;
  amount?: number | null;
  estimatedFee?: number | null;
  unpaidFee?: number | null;
  violationReason?: string | null;
  feePolicyId?: string | null;
  feePolicyName?: string | null;
  feePolicySource?: 'session' | 'parkingLot' | 'fallback' | string | null;
  parkingSpace?: {
    id?: string | null;
    code?: string | null;
    status?: string | null;
    section?: {
      id?: string | null;
      name?: string | null;
      parkingLot?: {
        id?: string | null;
        name?: string | null;
        code?: string | null;
      } | null;
    } | null;
  } | null;
};

function unwrapItems<T>(value: unknown): T[] {
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

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
  });
}

function formatCurrency(value?: number | null) {
  return `₩${Number(value ?? 0).toLocaleString()}`;
}

function getEstimatedFee(item: EnforcementItem) {
  return Number(item.amount ?? item.estimatedFee ?? item.unpaidFee ?? 0);
}

function formatElapsed(minutes?: number | null) {
  if (minutes === null || minutes === undefined) return '-';

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${hours}h ${rest}m`;
}

function getParkingSpace(item: EnforcementItem) {
  const apiItem = item as EnforcementItem & {
    ParkingSpace?: EnforcementItem['parkingSpace'];
  };

  return apiItem.parkingSpace ?? apiItem.ParkingSpace ?? null;
}

function getParkingLotName(item: EnforcementItem) {
  const space = getParkingSpace(item);

  return (
    space?.section?.parkingLot?.name ??
    space?.section?.parkingLot?.code ??
    '-'
  );
}

function getSectionName(item: EnforcementItem) {
  return getParkingSpace(item)?.section?.name ?? '-';
}

function getSpaceCode(item: EnforcementItem) {
  return getParkingSpace(item)?.code ?? '-';
}

export default function EnforcementPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<EnforcementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<EnforcementItem | null>(null);
  const [plateNumber, setPlateNumber] = useState<Record<string, string>>({});
  const [contactNumber, setContactNumber] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canRegister =
    role === 'admin' || role === 'manager' || role === 'operator';

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/enforcement/unregistered-overstay', {
        accessToken: session.accessToken,
      });

      setItems(unwrapItems<EnforcementItem>(result));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '단속 대상을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function registerSession(item: EnforcementItem) {
    if (!session?.accessToken || !canRegister) return;

    const plate = plateNumber[item.id]?.trim() ?? '';
    const contact = contactNumber[item.id]?.trim() ?? '';

    if (!plate && !contact) {
      setError('차량번호 또는 연락처를 입력하세요.');
      return;
    }

    setRegisteringId(item.id);
    setError(null);
    setNotice(null);

    try {
      await apiFetch(`/parking-sessions/${item.id}/register`, {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: JSON.stringify({
          plateNumber: plate || null,
          contactNumber: contact || null,
        }),
      });

      setNotice(`Session ${item.sessionNo ?? item.id} registered.`);
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '주차 등록 처리에 실패했습니다.',
      );
    } finally {
      setRegisteringId(null);
    }
  }

  const oldest = items[0];

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            단속 관리
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            입차 후 10분이 지나도록 주차 등록이 되지 않은 차량을 확인하고
            등록 처리합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">10분 초과 미등록</div>
          <div className="mt-2 text-3xl font-semibold">{items.length}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">최장 경과 대상</div>
          <div className="mt-2 text-lg font-semibold">
            {oldest ? formatElapsed(oldest.elapsedMinutes) : '-'}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">예상 요금 합계</div>
          <div className="mt-2 text-lg font-semibold">
            {formatCurrency(
              items.reduce((sum, item) => sum + getEstimatedFee(item), 0),
            )}
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-3xl border bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">구역</th>
              <th className="px-4 py-3">주차면</th>
              <th className="px-4 py-3">입차일시</th>
              <th className="px-4 py-3">경과시간</th>
              <th className="px-4 py-3">예상 요금</th>
              <th className="px-4 py-3">사유</th>
              <th className="px-4 py-3">주차 등록</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-slate-500">
                  불러오는 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  10분 초과 미등록 차량이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(item)}
                      className="font-black text-blue-600 underline-offset-2 hover:underline"
                    >
                      {index + 1}
                    </button>
                  </td>
                  <td className="px-4 py-3">{getParkingLotName(item)}</td>
                  <td className="px-4 py-3">{getSectionName(item)}</td>
                  <td className="px-4 py-3">{getSpaceCode(item)}</td>
                  <td className="px-4 py-3">{formatDate(item.entryTime)}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">
                    {formatElapsed(item.elapsedMinutes)}
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(getEstimatedFee(item))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      {item.violationReason ?? 'UNREGISTERED'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canRegister ? (
                      <a
                        href={`/admin/parking/sessions?filter=UNREGISTERED_OVER_10&sessionId=${encodeURIComponent(String(item.id))}&action=register`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700"
                      >
                        주차 등록
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        권한 없음
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selectedDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">단속 대상 상세</h2>
                <p className="mt-1 text-sm text-slate-500">
                  세션과 주차 위치, 예상 요금 정보를 확인합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="rounded-xl border px-3 py-2 text-sm font-bold hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
              {[
                ['세션 번호', selectedDetail.sessionNo ?? selectedDetail.id],
                ['상태', selectedDetail.status ?? '-'],
                ['주차장', getParkingLotName(selectedDetail)],
                ['구역', getSectionName(selectedDetail)],
                ['주차면', getSpaceCode(selectedDetail)],
                ['입차일시', formatDate(selectedDetail.entryTime)],
                ['경과시간', formatElapsed(selectedDetail.elapsedMinutes)],
                ['예상 요금', formatCurrency(getEstimatedFee(selectedDetail))],
                [
                  '적용 요금정책',
                  selectedDetail.feePolicyName
                    ? `${selectedDetail.feePolicyName} (${selectedDetail.feePolicySource ?? '-'})`
                    : '요금정책 없음',
                ],
                ['사유', selectedDetail.violationReason ?? 'UNREGISTERED'],
                ['등록 여부', selectedDetail.isRegistered ? '등록됨' : '미등록'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-black text-slate-400">{label}</div>
                  <div className="mt-1 break-all font-bold text-slate-900">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
