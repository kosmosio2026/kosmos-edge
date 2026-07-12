'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useMemo, useState } from 'react';

const API_BASE =
  getPublicApiBaseUrl();

type ParkingLotOption = {
  id: string;
  name: string;
  code?: string | null;
  region?: string | null;
  district?: string | null;
};

type RegionOption = {
  region: string;
  districts: string[];
};

type Props = {
  parkingLotId?: string;
  onChange: (next: {
    region: string;
    district: string;
    parkingLotId: string;
  }) => void;
};

function unwrapArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as {
      data?: unknown;
      items?: unknown;
      regions?: unknown;
      parkingLots?: unknown;
    };

    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.regions)) return obj.regions as T[];
    if (Array.isArray(obj.parkingLots)) return obj.parkingLots as T[];
  }

  return [];
}

function normalizeRegions(value: unknown): RegionOption[] {
  return unwrapArray<any>(value)
    .map((item) => {
      const region = String(item?.region ?? item?.sido ?? '').trim();

      const districtsRaw =
        item?.districts ??
        item?.districtList ??
        item?.sigungu ??
        item?.sigunguList ??
        [];

      const districts = Array.isArray(districtsRaw)
        ? districtsRaw.map((v) => String(v).trim()).filter(Boolean)
        : [];

      return {
        region,
        districts,
      };
    })
    .filter((item) => item.region);
}

function normalizeLots(value: unknown): ParkingLotOption[] {
  return unwrapArray<any>(value)
    .map((item) => ({
      id: String(item?.id ?? ''),
      name: String(item?.name ?? ''),
      code: item?.code ?? null,
      region: item?.region ?? item?.sido ?? null,
      district: item?.district ?? item?.sigungu ?? null,
    }))
    .filter((item) => item.id && item.name);
}

export default function ParkingLotRegionFilter({
  parkingLotId,
  onChange,
}: Props) {
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [lots, setLots] = useState<ParkingLotOption[]>([]);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');

  const districtOptions = useMemo(() => {
    return regions.find((item) => item.region === region)?.districts ?? [];
  }, [regions, region]);

  useEffect(() => {
    async function loadRegions() {
      try {
        const res = await fetch(`${API_BASE}/public/parking-lots/regions`, {
          cache: 'no-store',
        });
        const data = await res.json();
        setRegions(normalizeRegions(data));
      } catch {
        setRegions([]);
      }
    }

    loadRegions();
  }, []);

  useEffect(() => {
    async function loadLots() {
      const params = new URLSearchParams();

      if (region) {
        params.set('region', region);
        params.set('sido', region);
      }

      if (district) {
        params.set('district', district);
        params.set('sigungu', district);
      }

      try {
        const query = params.toString();
        const res = await fetch(
          `${API_BASE}/public/parking-lots${query ? `?${query}` : ''}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        setLots(normalizeLots(data));
      } catch {
        setLots([]);
      }
    }

    loadLots();
  }, [region, district]);

  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-3">
      <label className="block">
        <span className="text-xs font-bold text-slate-500">시도</span>
        <select
          value={region}
          onChange={(event) => {
            const nextRegion = event.target.value;
            setRegion(nextRegion);
            setDistrict('');
            onChange({
              region: nextRegion,
              district: '',
              parkingLotId: '',
            });
          }}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
        >
          <option value="">전체 시도</option>
          {regions.map((item) => (
            <option key={item.region} value={item.region}>
              {item.region}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-bold text-slate-500">시군구</span>
        <select
          value={district}
          onChange={(event) => {
            const nextDistrict = event.target.value;
            setDistrict(nextDistrict);
            onChange({
              region,
              district: nextDistrict,
              parkingLotId: '',
            });
          }}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
        >
          <option value="">전체 시군구</option>
          {districtOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-bold text-slate-500">주차장</span>
        <select
          value={parkingLotId ?? ''}
          onChange={(event) =>
            onChange({
              region,
              district,
              parkingLotId: event.target.value,
            })
          }
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
        >
          <option value="">전체 주차장</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
              {lot.code ? ` (${lot.code})` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
