'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';
import { canManageUsers } from '@/lib/console-role';
import { useAuth } from '@/components/providers/auth-provider';

type Props = {
  role?: ConsoleRole;
};

type PendingUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

type ParkingLot = {
  id: string;
  name: string;
};

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

export default function UsersPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManageUsers(role);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [pending, parkingLots] = await Promise.all([
        apiFetch('/users/pending/approvals', {
          accessToken: session.accessToken,
        }),
        apiFetch('/facilities/lots', {
          accessToken: session.accessToken,
        }),
      ]);

      setUsers(unwrapList<PendingUser>(pending));
      setLots(unwrapList<ParkingLot>(parkingLots));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load pending users.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleLot(userId: string, lotId: string) {
    if (!canManage) return;

    setSelected((prev) => {
      const current = prev[userId] ?? [];

      return {
        ...prev,
        [userId]: current.includes(lotId)
          ? current.filter((id) => id !== lotId)
          : [...current, lotId],
      };
    });
  }

  async function approve(userId: string) {
    if (!canManage) return;

    if (!session?.accessToken) {
      setError('Unauthorized: login session is missing. Please log in again.');
      return;
    }

    setApprovingId(userId);
    setError(null);

    try {
      await apiFetch(`/users/${userId}/approve`, {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: JSON.stringify({
          lotIds: selected[userId] ?? [],
          sectionIds: [],
        }),
      });

      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to approve user.',
      );
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">User Approvals</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canManage
              ? '승인 대기 사용자를 확인하고 주차장 권한을 부여합니다.'
              : '승인 대기 사용자를 조회합니다.'}
          </p>
        </div>

        {!canManage ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            View only
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      <section className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="rounded-2xl border bg-white p-4">
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-slate-600">{user.email}</div>
            <div className="mb-3 text-sm text-slate-600">
              {user.roles.join(', ')}
            </div>

            {canManage ? (
              <div className="mb-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Parking Lot Access
                </div>

                <div className="flex flex-wrap gap-2">
                  {lots.map((lot) => (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => toggleLot(user.id, lot.id)}
                      className={[
                        'rounded border px-3 py-1 text-sm',
                        (selected[user.id] ?? []).includes(lot.id)
                          ? 'bg-black text-white'
                          : 'bg-white hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {lot.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {canManage ? (
              <button
                type="button"
                onClick={() => approve(user.id)}
                disabled={approvingId === user.id}
                className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {approvingId === user.id ? 'Approving...' : 'Approve'}
              </button>
            ) : null}
          </div>
        ))}

        {!loading && users.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">
            No pending users.
          </div>
        ) : null}
      </section>
    </main>
  );
}
