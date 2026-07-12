'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchBillingSummary } from '@/lib/fetchers';

type Role = 'admin' | 'manager' | 'operator';

type BillingSummary = {
  todayRevenue?: number;
  monthRevenue?: number;
  outstanding?: number | { totalOpenAmount?: number | null } | null;
  collections?: number;
  invoiceCount?: number;
  paidCount?: number;
  failedCount?: number;
};

type Props = {
  role?: Role;
};

function unwrapData<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return ((value as { data?: T }).data ?? fallback) as T;
  }

  return (value ?? fallback) as T;
}

function getOutstandingValue(
  outstanding: BillingSummary['outstanding'],
): number {
  if (typeof outstanding === 'number') return outstanding;

  if (outstanding && typeof outstanding === 'object') {
    return outstanding.totalOpenAmount ?? 0;
  }

  return 0;
}

export default function BillingSummaryPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    const response = await fetchBillingSummary(session.accessToken);
    setSummary(unwrapData<BillingSummary | null>(response, null));
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleLabel =
    role === 'admin'
      ? '전체 정산/매출 요약'
      : role === 'manager'
        ? '권한 주차장 매출 요약'
        : '운영 요금 요약';

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Billing Summary</h1>
        <p className="text-sm text-slate-500">{roleLabel}</p>
      </header>

      <section className="grid gap-6 md:grid-cols-4">
        <Card title="Today Revenue" value={summary?.todayRevenue ?? 0} />
        <Card title="Month Revenue" value={summary?.monthRevenue ?? 0} />
        <Card
          title="Outstanding"
          value={getOutstandingValue(summary?.outstanding)}
        />
        <Card title="Collections" value={summary?.collections ?? 0} />
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-semibold">정산 요약</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Invoices" value={summary?.invoiceCount ?? 0} />
          <Metric label="Paid" value={summary?.paidCount ?? 0} />
          <Metric label="Failed" value={summary?.failedCount ?? 0} />
        </div>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-3 text-3xl font-bold">
        ₩ {Number(value ?? 0).toLocaleString()}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}