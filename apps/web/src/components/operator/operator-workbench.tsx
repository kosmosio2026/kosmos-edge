'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collectQuickAction,
  entryQuickAction,
  exitQuickAction,
  faultQuickAction,
  getOperatorMapData,
  registerOccupiedSpace,
} from '@/lib/api';
import { getRealtimeSocket, disconnectRealtimeSocket } from '@/lib/realtime';
import type { AuthUser } from '@/types/auth';
import type {
  OperatorEventLogItem,
  OperatorFilters,
  OperatorMapResponse,
  OperatorQuickAction,
  ParkingLotMapItem,
  ParkingSpaceMapItem,
} from '@/types/operator';
import { OperatorKakaoMap } from '@/components/maps/operator-kakao-map';
import { LotSummaryCard } from './lot-summary-card';
import { SpaceDetailDrawer } from './space-detail-drawer';
import { FilterBar } from './filter-bar';
import { EventLogPanel } from './event-log-panel';
import { QuickActions } from './quick-actions';
import { SpaceGrid } from './space-grid';
import { OperatorMobileTabs } from './operator-mobile-tabs';
import { normalizeRealtimeEvent } from '@/lib/realtime-payload';
import type { ConsoleRole } from '@/lib/console-role';

type OperatorWorkbenchProps = {
  role?: ConsoleRole;
  mode?: 'dashboard' | 'map';
  user: AuthUser;
  accessToken: string;
  showHeader?: boolean;
  readOnly?: boolean;
};

function createLog(
  message: string,
  level: 'info' | 'warn' | 'danger' = 'info',
): OperatorEventLogItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    createdAt: new Date().toLocaleString(),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Failed to load operator map data.';
}

function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybe = error as {
    status?: number;
    statusCode?: number;
    message?: string;
  };

  return (
    maybe.status === 401 ||
    maybe.statusCode === 401 ||
    String(maybe.message ?? '').toLowerCase().includes('unauthorized')
  );
}

export function OperatorWorkbench({
  role = 'operator',
  mode = 'dashboard',
  user,
  accessToken,
  showHeader = true,
  readOnly = false,
}: OperatorWorkbenchProps) {
  const effectiveRole = role;

  const [data, setData] = useState<OperatorMapResponse>({
    parkingLots: [],
    spaces: [],
  });
  const [selectedLot, setSelectedLot] = useState<ParkingLotMapItem | null>(null);
  const [selectedSpace, setSelectedSpace] =
    useState<ParkingSpaceMapItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<OperatorEventLogItem[]>([]);
  const [mobileTab, setMobileTab] = useState<'summary' | 'map' | 'grid' | 'log'>(
    'summary',
  );
  const [filters, setFilters] = useState<OperatorFilters>({
    parkingLotId: '',
    sectionId: '',
    search: '',
    viewMode: 'map',
  });

  async function load(parkingLotId?: string) {
    if (!accessToken) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await getOperatorMapData(accessToken, parkingLotId);
      setData(result);
    } catch (error) {
      console.error(error);

      const message = isUnauthorizedError(error)
        ? 'Unauthorized. Please log in again or check operator.dashboard.read permission.'
        : getErrorMessage(error);

      setErrorMessage(message);
      setLogs((prev) => [createLog(message, 'danger'), ...prev].slice(0, 30));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = getRealtimeSocket(accessToken);

    function handleEvent(eventName: string, payload: any) {
      const normalized = normalizeRealtimeEvent(eventName, payload);

      setLogs((prev) =>
        [
          createLog(
            normalized.message,
            normalized.type === 'device.fault' ? 'warn' : 'info',
          ),
          ...prev,
        ].slice(0, 30),
      );

      const affectedLotId = normalized.lotId;
      const activeLotId = selectedLot?.id || filters.parkingLotId;

      if (!affectedLotId || !activeLotId || affectedLotId === activeLotId) {
        void load(activeLotId || undefined);
      }
    }

    socket.on('connect', () => {
      setLogs((prev) => [createLog('실시간 연결됨'), ...prev].slice(0, 30));
    });

    socket.on('parking.entry', (payload: any) => {
      handleEvent('parking.entry', payload);
    });

    socket.on('parking.exit', (payload: any) => {
      handleEvent('parking.exit', payload);
    });

    socket.on('device.fault', (payload: any) => {
      handleEvent('device.fault', payload);
    });

    return () => {
      socket.off('connect');
      socket.off('parking.entry');
      socket.off('parking.exit');
      socket.off('device.fault');
      disconnectRealtimeSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedLot?.id, filters.parkingLotId]);

  const filteredSpaces = useMemo(() => {
    return data.spaces.filter((space) => {
      if (filters.parkingLotId && space.lotId !== filters.parkingLotId) {
        return false;
      }

      if (filters.sectionId && space.sectionId !== filters.sectionId) {
        return false;
      }

      if (
        filters.search &&
        !space.code.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [data.spaces, filters]);

  const kpis = useMemo(() => {
    return {
      spaces: filteredSpaces.length,
      unregistered: filteredSpaces.filter(
        (space) => space.occupancyState === 'OCCUPIED_UNREGISTERED',
      ).length,
      violations: filteredSpaces.filter(
        (space) => space.occupancyState === 'VIOLATION',
      ).length,
    };
  }, [filteredSpaces]);

  async function handleLotClick(lot: ParkingLotMapItem) {
    setSelectedLot(lot);
    setFilters((prev) => ({
      ...prev,
      parkingLotId: lot.id,
      sectionId: '',
    }));
    setLogs((prev) => [createLog(`${lot.name} 선택`), ...prev].slice(0, 30));
    await load(lot.id);
  }

  function handleSpaceClick(space: ParkingSpaceMapItem) {
    setSelectedSpace(space);
    setDrawerOpen(true);
    setLogs((prev) => [createLog(`${space.code} 클릭`), ...prev].slice(0, 30));
  }

  async function handleRegister() {
    if (readOnly) return;
    if (!selectedSpace) return;

    setRegistering(true);

    try {
      await registerOccupiedSpace(accessToken, {
        parkingSpaceId: selectedSpace.id,
      });

      setLogs((prev) =>
        [createLog(`${selectedSpace.code} 주차 등록 완료`), ...prev].slice(0, 30),
      );
      setDrawerOpen(false);
      setSelectedSpace(null);
      await load(selectedLot?.id || filters.parkingLotId || undefined);
    } catch (error) {
      setLogs((prev) =>
        [
          createLog(
            error instanceof Error ? error.message : '주차 등록 실패',
            'danger',
          ),
          ...prev,
        ].slice(0, 30),
      );
    } finally {
      setRegistering(false);
    }
  }

  async function handleQuickAction(action: OperatorQuickAction) {
    if (readOnly) return;
    if (!selectedSpace) return;

    try {
      switch (action) {
        case 'register':
          await handleRegister();
          return;
        case 'entry':
          await entryQuickAction(accessToken, selectedSpace.id);
          setLogs((prev) =>
            [createLog(`${selectedSpace.code} 입차 처리`), ...prev].slice(0, 30),
          );
          break;
        case 'exit':
          await exitQuickAction(accessToken, selectedSpace.id);
          setLogs((prev) =>
            [createLog(`${selectedSpace.code} 출차 처리`), ...prev].slice(0, 30),
          );
          break;
        case 'collect':
          await collectQuickAction(accessToken, selectedSpace.id);
          setLogs((prev) =>
            [createLog(`${selectedSpace.code} 수금 처리`), ...prev].slice(0, 30),
          );
          break;
        case 'fault':
          await faultQuickAction(accessToken, selectedSpace.id);
          setLogs((prev) =>
            [
              createLog(`${selectedSpace.code} 장애 접수`, 'warn'),
              ...prev,
            ].slice(0, 30),
          );
          break;
      }

      await load(selectedLot?.id || filters.parkingLotId || undefined);
    } catch (error) {
      setLogs((prev) =>
        [
          createLog(
            error instanceof Error ? error.message : '작업 실패',
            'danger',
          ),
          ...prev,
        ].slice(0, 30),
      );
    }
  }

  const lotForSummary =
    selectedLot ??
    data.parkingLots.find((lot) => lot.id === filters.parkingLotId) ??
    null;

  const isMapMode = mode === 'map';
  const isDashboardMode = mode === 'dashboard';

  const summaryPane = (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">담당 주차면</div>
          <div className="mt-2 text-2xl font-semibold">{kpis.spaces}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">미등록 점유</div>
          <div className="mt-2 text-2xl font-semibold">{kpis.unregistered}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">위반 후보</div>
          <div className="mt-2 text-2xl font-semibold">{kpis.violations}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">사용자</div>
          <div className="mt-2 text-2xl font-semibold">{user.name}</div>
        </div>
      </div>

      <LotSummaryCard lot={lotForSummary} />

      {!readOnly ? (
        <QuickActions
          selectedSpace={selectedSpace}
          onAction={handleQuickAction}
        />
      ) : null}
    </>
  );

  return (
    <div className="space-y-6">
      {effectiveRole ? null : null}
      {showHeader ? (
        <div>
          <h1 className="text-2xl font-semibold">Operator Workbench</h1>
          <p className="text-sm text-slate-500">
            실시간 현장 운영 · 지도 기반 주차 등록
          </p>
        </div>
      ) : null}

      {readOnly ? (
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-600">
          View only mode
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
          Loading operator map data...
        </div>
      ) : null}

      {isMapMode ? (
        <OperatorMobileTabs active={mobileTab} onChange={setMobileTab} />
      ) : null}

      <FilterBar
        lots={data.parkingLots}
        spaces={data.spaces}
        filters={filters}
        onChange={(next) => setFilters(next)}
      />

      <div className="hidden space-y-6 md:block">
        {summaryPane}

        {isMapMode ? (
          filters.viewMode === 'map' ? (
            <OperatorKakaoMap
              parkingLots={data.parkingLots}
              spaces={filteredSpaces}
              selectedLotId={filters.parkingLotId || selectedLot?.id}
              onLotClick={handleLotClick}
              onSpaceClick={handleSpaceClick}
            />
          ) : (
            <SpaceGrid spaces={filteredSpaces} onSelect={handleSpaceClick} />
          )
        ) : null}

        <EventLogPanel items={logs} />
      </div>

      <div className="space-y-6 md:hidden">
        {isDashboardMode ? summaryPane : null}
        {isMapMode && mobileTab === 'summary' ? summaryPane : null}

        {isMapMode && mobileTab === 'map' ? (
          <OperatorKakaoMap
            parkingLots={data.parkingLots}
            spaces={filteredSpaces}
            selectedLotId={filters.parkingLotId || selectedLot?.id}
            onLotClick={handleLotClick}
            onSpaceClick={handleSpaceClick}
          />
        ) : null}

        {isMapMode && mobileTab === 'grid' ? (
          <SpaceGrid spaces={filteredSpaces} onSelect={handleSpaceClick} />
        ) : null}

        {mobileTab === 'log' ? <EventLogPanel items={logs} /> : null}
      </div>

<SpaceDetailDrawer
  open={drawerOpen}
  space={selectedSpace}
  loading={registering}
  onClose={() => {
    setDrawerOpen(false);
    setSelectedSpace(null);
  }}
  onRegister={() => {
    if (readOnly) return;
    void handleRegister();
  }}
/>
    </div>
  );
}