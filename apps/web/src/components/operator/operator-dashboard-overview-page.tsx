'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { getOperatorMapData } from '@/lib/api';

type SpaceLike = {
  id?: string;
  code?: string;
  status?: string | null;
  occupancyState?: string | null;
  lotId?: string | null;
  sectionId?: string | null;
  deviceStatus?: string | number | null;
  parkingStatus?: string | number | null;
};

type LotLike = {
  id?: string;
  name?: string;
  code?: string | null;
};

type OperatorMapLike = {
  parkingLots?: LotLike[];
  spaces?: SpaceLike[];
};

function normalizeStatus(value?: string | number | null) {
  if (value === null || value === undefined) return '';

  return String(value).toUpperCase();
}

function isOccupied(space: SpaceLike) {
  const occupancy = normalizeStatus(space.occupancyState);
  const status = normalizeStatus(space.status);
  const parkingStatus = normalizeStatus(space.parkingStatus);

  return (
    occupancy.includes('OCCUPIED') ||
    status.includes('OCCUPIED') ||
    parkingStatus === '1'
  );
}

function isUnregistered(space: SpaceLike) {
  return normalizeStatus(space.occupancyState).includes('UNREGISTERED');
}

function isViolation(space: SpaceLike) {
  const occupancy = normalizeStatus(space.occupancyState);
  const status = normalizeStatus(space.status);

  return occupancy.includes('VIOLATION') || status.includes('VIOLATION');
}

function isFault(space: SpaceLike) {
  const status = normalizeStatus(space.status);
  const deviceStatus = normalizeStatus(space.deviceStatus);

  return (
    status.includes('FAULT') ||
    status.includes('ERROR') ||
    deviceStatus === '2' ||
    deviceStatus.includes('FAULT')
  );
}

export function OperatorDashboardOverviewPage() {
  const { session, user, isReady } = useAuth();

  const [data, setData] = useState<OperatorMapLike>({
    parkingLots: [],
    spaces: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accessToken = session?.accessToken;
  const currentUser = user ?? session?.user ?? null;

  const load = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError('');

    try {
      const result = await getOperatorMapData(accessToken);
      setData({
        parkingLots: result.parkingLots ?? [],
        spaces: result.spaces ?? [],
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load dashboard status.',
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  const summary = useMemo(() => {
    const spaces = data.spaces ?? [];
    const occupied = spaces.filter(isOccupied);
    const unregistered = spaces.filter(isUnregistered);
    const violations = spaces.filter(isViolation);
    const faults = spaces.filter(isFault);

    return {
      lots: data.parkingLots?.length ?? 0,
      spaces: spaces.length,
      occupied: occupied.length,
      available: Math.max(0, spaces.length - occupied.length),
      unregistered: unregistered.length,
      violations: violations.length,
      faults: faults.length,
    };
  }, [data]);

  const attentionSpaces = useMemo(() => {
    return (data.spaces ?? [])
      .filter((space) => isUnregistered(space) || isViolation(space) || isFault(space))
      .slice(0, 12);
  }, [data.spaces]);

  if (!isReady) {
    return (
      <main className="space-y-6 p-6">
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
          Loading operator dashboard...
        </div>
      </main>
    );
  }

  if (!accessToken || !currentUser) {
    return (
      <main className="space-y-6 p-6">
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
          Preparing login...
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operator Dashboard</h1>
          <p className="text-sm text-slate-500">
            실시간 주차 운영 상태와 주의가 필요한 주차면을 요약합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
          Loading dashboard status...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Parking Lots</div>
          <div className="mt-2 text-3xl font-semibold">{summary.lots}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Total Spaces</div>
          <div className="mt-2 text-3xl font-semibold">{summary.spaces}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Occupied</div>
          <div className="mt-2 text-3xl font-semibold">{summary.occupied}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Available</div>
          <div className="mt-2 text-3xl font-semibold">{summary.available}</div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Unregistered Occupied</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">
            {summary.unregistered}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Violation Candidates</div>
          <div className="mt-2 text-3xl font-semibold text-orange-600">
            {summary.violations}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Device Faults</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.faults}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Attention Required</h2>
          <p className="text-sm text-slate-500">
            미등록 점유, 위반 후보, 장비 장애 상태의 주차면을 표시합니다.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Space</th>
                <th className="px-4 py-3">Occupancy</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lot ID</th>
                <th className="px-4 py-3">Section ID</th>
              </tr>
            </thead>

            <tbody>
              {attentionSpaces.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No attention items.
                  </td>
                </tr>
              ) : (
                attentionSpaces.map((space, index) => (
                  <tr key={space.id ?? space.code ?? index} className="border-t">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      {space.code ?? space.id ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      {space.occupancyState ?? '-'}
                    </td>
                    <td className="px-4 py-3">{space.status ?? '-'}</td>
                    <td className="px-4 py-3">{space.lotId ?? '-'}</td>
                    <td className="px-4 py-3">{space.sectionId ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
