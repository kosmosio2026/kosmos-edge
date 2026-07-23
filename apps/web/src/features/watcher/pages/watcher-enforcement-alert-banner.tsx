'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, getToken } from './watcher-utils';

type EnforcementCaseItem = {
  id?: string;
  parkingSessionId?: string;
  plateNumber?: string;
  vehiclePlateNumber?: string;
  status?: string;
  createdAt?: string;
  violationAt?: string;
  parkingLot?: {
    name?: string;
  };
  parkingSpace?: {
    code?: string;
  };
  section?: {
    name?: string;
  };
  metadata?: any;
};

function normalizeItems(payload: any): EnforcementCaseItem[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.cases)) return payload.cases;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getCaseKey(item: EnforcementCaseItem) {
  return (
    item.id ??
    item.parkingSessionId ??
    `${item.plateNumber ?? item.vehiclePlateNumber ?? 'unknown'}-${item.violationAt ?? item.createdAt ?? ''}`
  );
}

function getStoredKeys() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem('kosmos.watcherKnownEnforcementCaseKeys');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return new Set(parsed.map(String));
  } catch {
    return null;
  }
}

function setStoredKeys(keys: Set<string>) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      'kosmos.watcherKnownEnforcementCaseKeys',
      JSON.stringify(Array.from(keys).slice(0, 200)),
    );
  } catch {
    // localStorage unavailable
  }
}

function formatCaseSummary(item: EnforcementCaseItem) {
  const lotName = item.parkingLot?.name ?? '주차장';
  const spaceCode = item.parkingSpace?.code ?? item.section?.name ?? '-';
  const plateNumber = item.plateNumber ?? item.vehiclePlateNumber ?? '-';

  return `${lotName} · ${spaceCode} · ${plateNumber}`;
}

export default function WatcherEnforcementAlertBanner() {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [latestItems, setLatestItems] = useState<EnforcementCaseItem[]>([]);
  const [message, setMessage] = useState('');
  const knownKeysRef = useRef<Set<string> | null>(null);

  async function loadEnforcementCases(options?: { silent?: boolean }) {
    const token = getToken();

    if (!token) {
      setCount(0);
      setLatestItems([]);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const json = await apiFetch('/watcher/enforcement-cases');
      const items = normalizeItems(json);
      const nextKeys = new Set(items.map(getCaseKey).filter(Boolean));
      const previousKeys = knownKeysRef.current ?? getStoredKeys();

      setCount(items.length);
      setLatestItems(items.slice(0, 5));

      if (previousKeys) {
        const newItems = items.filter((item) => !previousKeys.has(getCaseKey(item)));

        if (newItems.length > 0) {
          setNewCount(newItems.length);
          setMessage(`신규 단속 대상 ${newItems.length}건이 발생했습니다.`);

          if (typeof window !== 'undefined') {
            document.title = `(${newItems.length}) Watcher 단속 알림`;
            window.navigator.vibrate?.([160, 80, 160]);
          }
        }
      }

      knownKeysRef.current = nextKeys;
      setStoredKeys(nextKeys);
    } catch (error: any) {
      if (!options?.silent) {
        setMessage(error?.message ?? '단속 알림 정보를 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEnforcementCases();

    const intervalId = window.setInterval(() => {
      void loadEnforcementCases({ silent: true });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const headline = useMemo(() => {
    if (newCount > 0) return `신규 단속 ${newCount}건`;
    if (count > 0) return `현재 단속 대상 ${count}건`;
    return '현재 단속 대상 없음';
  }, [count, newCount]);

  function clearNotice() {
    setNewCount(0);
    setMessage('');
    if (typeof window !== 'undefined') {
      document.title = 'Watcher 단속 앱';
    }
  }

  return (
    <section
      className={`rounded-3xl p-5 shadow-sm ${
        newCount > 0
          ? 'bg-red-600 text-white'
          : count > 0
            ? 'bg-amber-50 text-amber-950'
            : 'bg-white text-slate-950'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-black uppercase tracking-[0.24em] ${
              newCount > 0 ? 'text-red-100' : 'text-slate-400'
            }`}
          >
            Enforcement Alert
          </p>
          <h2 className="mt-2 text-xl font-black">{headline}</h2>
          <p
            className={`mt-2 text-sm font-bold ${
              newCount > 0 ? 'text-red-50' : 'text-slate-500'
            }`}
          >
            30초마다 단속 대상 목록을 확인합니다.
          </p>
        </div>

        <div
          className={`grid h-14 w-14 place-items-center rounded-2xl text-2xl font-black ${
            newCount > 0
              ? 'bg-white text-red-600'
              : count > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          {count}
        </div>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-black ${
            newCount > 0 ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {message}
        </div>
      ) : null}

      {latestItems.length > 0 ? (
        <div className="mt-4 space-y-2">
          {latestItems.map((item) => (
            <a
              key={getCaseKey(item)}
              href={item.id ? `/watcher/enforcement/${item.id}` : '/watcher/enforcement'}
              className={`block rounded-2xl px-4 py-3 text-sm font-bold ${
                newCount > 0
                  ? 'bg-white/15 text-white'
                  : 'bg-white text-slate-800 shadow-sm'
              }`}
            >
              {formatCaseSummary(item)}
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <a
          href="/watcher/enforcement"
          className={`flex-1 rounded-2xl px-4 py-3 text-center text-sm font-black ${
            newCount > 0
              ? 'bg-white text-red-600'
              : 'bg-slate-950 text-white'
          }`}
        >
          단속 대상 보기
        </a>

        {newCount > 0 ? (
          <button
            type="button"
            onClick={clearNotice}
            className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-black text-white"
          >
            확인
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => loadEnforcementCases()}
          disabled={loading}
          className={`rounded-2xl px-4 py-3 text-sm font-black ${
            newCount > 0
              ? 'bg-white/15 text-white disabled:opacity-60'
              : 'bg-slate-100 text-slate-700 disabled:opacity-60'
          }`}
        >
          {loading ? '갱신 중' : '새로고침'}
        </button>
      </div>
    </section>
  );
}
