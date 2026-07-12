'use client';

import { OperatorWorkbench } from '@/components/operator/operator-workbench';
import { useAuth } from '@/components/providers/auth-provider';
import type { ConsoleRole } from '@/lib/console-role';

type OperatorDashboardPageProps = {
  role?: ConsoleRole;
  mode?: 'dashboard' | 'map';
  title?: string;
  description?: string;
  readOnly?: boolean;
};

export function OperatorDashboardPage({
  role = 'operator',
  mode = 'map',
  title = 'Operator Map',
  description = '주차장 지도와 주차면 상태를 실시간으로 확인합니다.',
  readOnly = false,
}: OperatorDashboardPageProps) {
  const { session, user, isReady } = useAuth();

  const accessToken = session?.accessToken;
  const currentUser = user ?? session?.user ?? null;

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      {!isReady ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
          Loading operator map...
        </div>
      ) : !accessToken || !currentUser ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
          Preparing login...
        </div>
      ) : (
        <OperatorWorkbench
          role={role}
          mode={mode}
          user={currentUser}
          accessToken={accessToken}
          showHeader={false}
          readOnly={readOnly}
        />
      )}
    </main>
  );
}
