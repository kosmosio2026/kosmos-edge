'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type AddressResult = {
  address: string;
  roadAddress?: string | null;
  jibunAddress?: string | null;
  zoneNo?: string | null;
  lat: number;
  lng: number;
};

type Props = {
  open: boolean;
  accessToken?: string;
  onClose: () => void;
  onSelect: (value: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
};

export function KoreaAddressModal({
  open,
  accessToken,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setItems([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!accessToken) return;

    const text = query.trim();

    if (text.length < 2) {
      setItems([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);

        const result = await apiFetch<AddressResult[]>(
          `/geo/address/search?query=${encodeURIComponent(text)}`,
          { accessToken },
        );

        setItems(Array.isArray(result) ? result : []);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, open, accessToken]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">도로명 주소 검색</h2>
            <p className="text-sm text-slate-500">
              주소를 입력하고 추천 목록에서 선택하세요.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            Close
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 서울 중구 세종대로 110"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
        />

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Searching...
            </div>
          ) : null}

          {!loading && items.length === 0 && query.trim().length >= 2 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              검색 결과가 없습니다.
            </div>
          ) : null}

          {items.map((item, index) => (
            <button
              key={`${item.address}-${index}`}
              type="button"
              onClick={() =>
                onSelect({
                  address: item.roadAddress ?? item.address,
                  lat: item.lat,
                  lng: item.lng,
                })
              }
              className="w-full rounded-2xl border p-4 text-left hover:bg-slate-50"
            >
              <div className="font-medium text-slate-900">
                {item.roadAddress ?? item.address}
              </div>

              {item.jibunAddress ? (
                <div className="mt-1 text-xs text-slate-500">
                  지번: {item.jibunAddress}
                </div>
              ) : null}

              <div className="mt-1 text-xs text-slate-400">
                lat: {item.lat}, lng: {item.lng}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}