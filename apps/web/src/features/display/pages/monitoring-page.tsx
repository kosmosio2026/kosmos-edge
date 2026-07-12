'use client';

import { useEffect, useState } from 'react';
import { DisplayBoardStatusCard } from '../components/display-board-status-card';
import { fetchDisplayBoards } from '@/lib/fetchers';
import { useAuth } from '@/components/providers/auth-provider';

export default function MonitoringPage() {
  const { session } = useAuth();
  const [boards, setBoards] = useState<any[]>([]);

  useEffect(() => {
    if (!session?.accessToken) return;

    fetchDisplayBoards(session.accessToken).then((res) => {
      setBoards(Array.isArray(res) ? res : []);
    });
  }, [session?.accessToken]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Display Board Monitoring</h1>

      <div className="grid gap-6 xl:grid-cols-2">
        {boards.map((board) => (
          <DisplayBoardStatusCard key={board.id} board={board} />
        ))}

        {boards.length === 0 && (
          <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500 xl:col-span-2">
            No display board data.
          </div>
        )}
      </div>
    </div>
  );
}
