'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type Role = 'admin' | 'manager';

type Invoice = {
  id: string;
  invoiceNo?: string;
  amount: number;
  status: string;
  user?: {
    name?: string | null;
    email?: string | null;
  };
  session?: {
    plateNumber?: string | null;
  };
};

type Props = {
  role?: 'admin' | 'manager' | 'operator';
};

export default function CollectionPage({
  role = 'admin',
}: Props) {
  const { session, isReady } = useAuth();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!session?.accessToken) return;

    setLoading(true);

    try {
      const data = await apiFetch<Invoice[]>('/billing/overdue', {
        accessToken: session.accessToken,
      });

      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady || !session?.accessToken) return;
    load();
  }, [isReady, session?.accessToken]);

  async function pay(id: string) {
    if (!session?.accessToken) return;

    await apiFetch(`/billing/pay/${id}`, {
      method: 'POST',
      accessToken: session.accessToken,
    });

    await load();
  }

  async function forceClose(id: string) {
    if (!session?.accessToken) return;

    await apiFetch(`/billing/force-close/${id}`, {
      method: 'POST',
      accessToken: session.accessToken,
    });

    await load();
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Collection</h1>
        <p className="mt-1 text-sm text-slate-500">
          {role === 'admin'
            ? '전체 미납 및 강제 정산을 관리합니다.'
            : '권한이 있는 주차장의 미납 및 강제 정산을 관리합니다.'}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="font-semibold text-slate-900">Overdue Invoices</div>
          <div className="text-sm text-slate-500">
            {loading ? 'Loading...' : `${items.length} item(s)`}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-semibold text-slate-900">
                  {invoice.invoiceNo ?? invoice.id}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {invoice.user?.name ?? invoice.user?.email ?? 'Unknown user'}
                  {invoice.session?.plateNumber
                    ? ` · ${invoice.session.plateNumber}`
                    : ''}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-bold text-slate-900">
                    ₩ {invoice.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-red-600">{invoice.status}</div>
                </div>

                <button
                  onClick={() => pay(invoice.id)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Pay
                </button>

                <button
                  onClick={() => forceClose(invoice.id)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Force Close
                </button>
              </div>
            </div>
          ))}

          {!loading && items.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No overdue invoices.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}