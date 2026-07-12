'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { KoreaAddressModal } from './korea-address-modal';

type ParkingLotForm = {
  id?: string;
  code: string;
  name: string;
  region: string;
  district: string;
  address: string;
  lat: string;
  lng: string;
  representative: string;
  contact: string;
};

type Props = {
  open: boolean;
  value?: any | null;
  accessToken?: string;
  onClose: () => void;
  onSaved: () => void;
};

const KOREA_REGIONS: Record<string, string[]> = {
  서울특별시: [
    '강남구',
    '강동구',
    '강북구',
    '강서구',
    '관악구',
    '광진구',
    '구로구',
    '금천구',
    '노원구',
    '도봉구',
    '동대문구',
    '동작구',
    '마포구',
    '서대문구',
    '서초구',
    '성동구',
    '성북구',
    '송파구',
    '양천구',
    '영등포구',
    '용산구',
    '은평구',
    '종로구',
    '중구',
    '중랑구',
  ],
  부산광역시: [
    '강서구',
    '금정구',
    '남구',
    '동구',
    '동래구',
    '부산진구',
    '북구',
    '사상구',
    '사하구',
    '서구',
    '수영구',
    '연제구',
    '영도구',
    '중구',
    '해운대구',
    '기장군',
  ],
  대구광역시: [
    '중구',
    '동구',
    '서구',
    '남구',
    '북구',
    '수성구',
    '달서구',
    '달성군',
    '군위군',
  ],
  인천광역시: [
    '중구',
    '동구',
    '미추홀구',
    '연수구',
    '남동구',
    '부평구',
    '계양구',
    '서구',
    '강화군',
    '옹진군',
  ],
  광주광역시: ['동구', '서구', '남구', '북구', '광산구'],
  대전광역시: ['동구', '중구', '서구', '유성구', '대덕구'],
  울산광역시: ['중구', '남구', '동구', '북구', '울주군'],
  세종특별자치시: ['세종시'],
  경기도: [
    '수원시',
    '성남시',
    '의정부시',
    '안양시',
    '부천시',
    '광명시',
    '평택시',
    '동두천시',
    '안산시',
    '고양시',
    '과천시',
    '구리시',
    '남양주시',
    '오산시',
    '시흥시',
    '군포시',
    '의왕시',
    '하남시',
    '용인시',
    '파주시',
    '이천시',
    '안성시',
    '김포시',
    '화성시',
    '광주시',
    '양주시',
    '포천시',
    '여주시',
    '연천군',
    '가평군',
    '양평군',
  ],
  강원특별자치도: [
    '춘천시',
    '원주시',
    '강릉시',
    '동해시',
    '태백시',
    '속초시',
    '삼척시',
    '홍천군',
    '횡성군',
    '영월군',
    '평창군',
    '정선군',
    '철원군',
    '화천군',
    '양구군',
    '인제군',
    '고성군',
    '양양군',
  ],
  충청북도: [
    '청주시',
    '충주시',
    '제천시',
    '보은군',
    '옥천군',
    '영동군',
    '증평군',
    '진천군',
    '괴산군',
    '음성군',
    '단양군',
  ],
  충청남도: [
    '천안시',
    '공주시',
    '보령시',
    '아산시',
    '서산시',
    '논산시',
    '계룡시',
    '당진시',
    '금산군',
    '부여군',
    '서천군',
    '청양군',
    '홍성군',
    '예산군',
    '태안군',
  ],
  전북특별자치도: [
    '전주시',
    '군산시',
    '익산시',
    '정읍시',
    '남원시',
    '김제시',
    '완주군',
    '진안군',
    '무주군',
    '장수군',
    '임실군',
    '순창군',
    '고창군',
    '부안군',
  ],
  전라남도: [
    '목포시',
    '여수시',
    '순천시',
    '나주시',
    '광양시',
    '담양군',
    '곡성군',
    '구례군',
    '고흥군',
    '보성군',
    '화순군',
    '장흥군',
    '강진군',
    '해남군',
    '영암군',
    '무안군',
    '함평군',
    '영광군',
    '장성군',
    '완도군',
    '진도군',
    '신안군',
  ],
  경상북도: [
    '포항시',
    '경주시',
    '김천시',
    '안동시',
    '구미시',
    '영주시',
    '영천시',
    '상주시',
    '문경시',
    '경산시',
    '의성군',
    '청송군',
    '영양군',
    '영덕군',
    '청도군',
    '고령군',
    '성주군',
    '칠곡군',
    '예천군',
    '봉화군',
    '울진군',
    '울릉군',
  ],
  경상남도: [
    '창원시',
    '진주시',
    '통영시',
    '사천시',
    '김해시',
    '밀양시',
    '거제시',
    '양산시',
    '의령군',
    '함안군',
    '창녕군',
    '고성군',
    '남해군',
    '하동군',
    '산청군',
    '함양군',
    '거창군',
    '합천군',
  ],
  제주특별자치도: ['제주시', '서귀포시'],
};

const initialForm: ParkingLotForm = {
  code: '',
  name: '',
  region: '',
  district: '',
  address: '',
  lat: '',
  lng: '',
  representative: '',
  contact: '',
};

function parseRegionDistrictFromAddress(address: string) {
  const parts = address
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return {
    region: parts[0] ?? '',
    district: parts[1] ?? '',
  };
}

export function ParkingLotFormModal({
  open,
  value,
  accessToken,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<ParkingLotForm>(initialForm);
  const [addressOpen, setAddressOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(value?.id);

  const districtOptions = useMemo(() => {
    return form.region ? KOREA_REGIONS[form.region] ?? [] : [];
  }, [form.region]);

  useEffect(() => {
    if (!open) return;

    if (value) {
      setForm({
        id: value.id,
        code: value.code ?? '',
        name: value.name ?? '',
        region: value.region ?? '',
        district: value.district ?? '',
        address: value.address ?? '',
        lat: value.lat != null ? String(value.lat) : '',
        lng: value.lng != null ? String(value.lng) : '',
        representative: value.representative ?? '',
        contact: value.contact ?? '',
      });
    } else {
      setForm(initialForm);
    }

    setError(null);
  }, [open, value]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken) {
      setError('Login session is missing.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        region: form.region.trim() || null,
        district: form.district.trim() || null,
        address: form.address.trim() || null,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        representative: form.representative.trim() || null,
        contact: form.contact.trim() || null,
      };

      await apiFetch(
        editing ? `/facilities/lots/${form.id}` : '/facilities/lots',
        {
          method: editing ? 'PATCH' : 'POST',
          accessToken,
          body: JSON.stringify(body),
        },
      );

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to save parking lot.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div>
            <h2 className="text-xl font-bold">
              {editing ? 'Edit Parking Lot' : 'Add Parking Lot'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              주차장 기본 정보와 주소 좌표를 입력합니다.
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={submit}
            className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <Input
              label="Code"
              required
              value={form.code}
              onChange={(value) => setForm({ ...form, code: value })}
            />

            <Input
              label="Name"
              required
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
            />

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Region / State / Province
              </span>
              <input
                required
                list="parking-lot-region-options"
                value={form.region}
                onChange={(event) =>
                  setForm({
                    ...form,
                    region: event.target.value,
                    district: '',
                  })
                }
                placeholder="예: 서울특별시, California"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
              <datalist id="parking-lot-region-options">
                {Object.keys(KOREA_REGIONS).map((region) => (
                  <option key={region} value={region} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                District / City / County
              </span>
              <input
                required
                list="parking-lot-district-options"
                value={form.district}
                onChange={(event) =>
                  setForm({ ...form, district: event.target.value })
                }
                placeholder="예: 강남구, San Francisco"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
              <datalist id="parking-lot-district-options">
                {districtOptions.map((district) => (
                  <option key={district} value={district} />
                ))}
              </datalist>
            </label>

            <Input
              label="Representative"
              value={form.representative}
              onChange={(value) =>
                setForm({ ...form, representative: value })
              }
            />

            <Input
              label="Contact"
              value={form.contact}
              onChange={(value) => setForm({ ...form, contact: value })}
            />

            <div className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Address
              </span>

              <div className="mt-1 grid gap-2">
                <input
                  required
                  value={form.address}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                  placeholder="도로명 주소"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />

                <button
                  type="button"
                  onClick={() => setAddressOpen(true)}
                  className="w-full rounded-xl border px-4 py-3 text-sm hover:bg-slate-50"
                >
                  도로명 주소 검색
                </button>
              </div>
            </div>

            <Input
              label="Latitude"
              value={form.lat}
              onChange={(value) => setForm({ ...form, lat: value })}
            />

            <Input
              label="Longitude"
              value={form.lng}
              onChange={(value) => setForm({ ...form, lng: value })}
            />

            <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-white pt-4 md:col-span-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <KoreaAddressModal
        open={addressOpen}
        accessToken={accessToken}
        onClose={() => setAddressOpen(false)}
        onSelect={({ address, lat, lng }) => {
          const parsed = parseRegionDistrictFromAddress(address);

          setForm((prev) => ({
            ...prev,
            region: prev.region || parsed.region,
            district: prev.district || parsed.district,
            address,
            lat: String(lat),
            lng: String(lng),
          }));

          setAddressOpen(false);
        }}
      />
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}
