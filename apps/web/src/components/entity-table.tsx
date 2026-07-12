'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

const endpointMap: Record<string, string> = {
  lots: '/facilities/lots',
  sections: '/facilities/sections',
  spaces: '/facilities/spaces',
  devices: '/devices/sensors',
  faults: '/devices/faults',
  members: '/users/members',
  visitors: '/users/visitors',
};

type ApiListResponse =
  | unknown[]
  | {
      items?: unknown[];
      data?: unknown[] | { items?: unknown[] };
    };

function normalizeItems(res: ApiListResponse): any[] {
  if (Array.isArray(res)) return res;

  if (res && typeof res === 'object') {
    const obj = res as {
      items?: unknown;
      data?: unknown;
    };

    if (Array.isArray(obj.items)) return obj.items;

    if (Array.isArray(obj.data)) return obj.data;

    if (
      obj.data &&
      typeof obj.data === 'object' &&
      Array.isArray((obj.data as { items?: unknown }).items)
    ) {
      return (obj.data as { items: unknown[] }).items;
    }
  }

  return [];
}

export default function EntityTable({
  entity,
  title,
  description,
  headers,
}: {
  entity: string;
  title: string;
  description?: string;
  headers: string[];
}) {
  const { session } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => endpointMap[entity] ?? `/${entity}`, [entity]);

  async function load() {
    if (!session?.accessToken) return;

    setError(null);

    try {
      const res = (await apiFetch(endpoint, {
        accessToken: session.accessToken,
      })) as ApiListResponse;

      setItems(normalizeItems(res));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.accessToken, endpoint]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description ? (
          <p className="text-sm text-slate-500">{description}</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} / endpoint: {endpoint}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-5 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item?.id ?? item?.code ?? index} className="border-t">
                <td className="px-5 py-3">{item?.name ?? item?.code ?? '-'}</td>
                <td className="px-5 py-3">
                  {item?.region ?? item?.parkingLot?.name ?? item?.status ?? '-'}
                </td>
                <td className="px-5 py-3">
                  {item?._count?.spaces ??
                    item?.spaces?.length ??
                    item?.section?.name ??
                    '-'}
                </td>
                <td className="px-5 py-3">
                  {item?.isActive === false ? 'Inactive' : 'Active'}
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  No data.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}