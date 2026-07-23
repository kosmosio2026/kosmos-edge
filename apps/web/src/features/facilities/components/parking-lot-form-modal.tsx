'use client';

import {
  formatKoreanPhoneNumber,
  validateKoreanPhoneNumber,
} from '@parking/shared/validation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ParkingLotPhoto = {
  id?: string;
  imageUrl: string;
  sortOrder?: number;
  isPrimary?: boolean;
};

type ParkingLotValue = {
  id?: string;
  code?: string | null;
  name?: string | null;
  region?: string | null;
  district?: string | null;
  representative?: string | null;
  contact?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  operationMode?: string | null;
  photos?: ParkingLotPhoto[];
};

type Props = {
  open: boolean;
  value?: ParkingLotValue | null;
  accessToken?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  code: string;
  name: string;
  region: string;
  district: string;
  representative: string;
  contact: string;
  address: string;
  lat: string;
  lng: string;
  operationMode: string;
  photos: string[];
};

function emptyForm(): FormState {
  return {
    code: '',
    name: '',
    region: '',
    district: '',
    representative: '',
    contact: '',
    address: '',
    lat: '',
    lng: '',
    operationMode: 'SENSOR',
    photos: [],
  };
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAddressInput(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeSidoName(value: unknown) {
  const raw = String(value ?? '').trim();

  const sidoMap: Record<string, string> = {
    서울: '서울특별시',
    부산: '부산광역시',
    대구: '대구광역시',
    인천: '인천광역시',
    광주: '광주광역시',
    대전: '대전광역시',
    울산: '울산광역시',
    세종: '세종특별자치시',
    경기: '경기도',
    강원: '강원특별자치도',
    충북: '충청북도',
    충남: '충청남도',
    전북: '전북특별자치도',
    전남: '전라남도',
    경북: '경상북도',
    경남: '경상남도',
    제주: '제주특별자치도',
  };

  return sidoMap[raw] ?? raw;
}

function normalizeSigunguName(value: unknown) {
  return String(value ?? '').trim();
}

function isValidLatitude(value: number | null) {
  return value == null || (value >= -90 && value <= 90);
}

function isValidLongitude(value: number | null) {
  return value == null || (value >= -180 && value <= 180);
}

function getCoordinateMessage(lat: number | null, lng: number | null) {
  if (lat == null && lng == null) {
    return '주소 검색 후 좌표를 자동 입력하거나 위도/경도를 직접 입력하세요.';
  }

  if (lat == null || lng == null) {
    return '위도와 경도는 함께 입력해야 합니다.';
  }

  if (!isValidLatitude(lat)) {
    return '위도는 -90부터 90 사이의 숫자로 입력하세요.';
  }

  if (!isValidLongitude(lng)) {
    return '경도는 -180부터 180 사이의 숫자로 입력하세요.';
  }

  return null;
}

function getKakaoMapsAppKey() {
  return process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || '';
}

function loadKakaoMapsServicesScript() {
  return new Promise<any>((resolve, reject) => {
    const currentKakao = (window as any).kakao;

    if (currentKakao?.maps?.services?.Geocoder) {
      resolve(currentKakao);
      return;
    }

    const appKey = getKakaoMapsAppKey();

    if (!appKey) {
      reject(new Error('Kakao 지도 JavaScript 키가 설정되지 않았습니다. 위도/경도를 직접 입력해 주세요.'));
      return;
    }

    const existingScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;
    const existingSrc = existingScript?.getAttribute('src') ?? '';

    if (existingScript && !existingSrc.includes('libraries=services')) {
      existingScript.remove();
      try {
        (window as any).kakao = undefined;
      } catch {
        // ignore
      }
    }

    const reusableScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;

    if (reusableScript) {
      reusableScript.addEventListener(
        'load',
        () => {
          const kakao = (window as any).kakao;

          if (!kakao?.maps?.load) {
            reject(new Error('Kakao 지도 SDK가 정상적으로 초기화되지 않았습니다.'));
            return;
          }

          kakao.maps.load(() => {
            if (kakao.maps.services?.Geocoder) {
              resolve(kakao);
              return;
            }

            reject(new Error('Kakao 좌표 변환 라이브러리를 찾지 못했습니다.'));
          });
        },
        { once: true },
      );

      reusableScript.addEventListener(
        'error',
        () => reject(new Error('Kakao 지도 SDK를 불러오지 못했습니다.')),
        { once: true },
      );

      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-map-sdk';
    script.async = true;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;

    script.onload = () => {
      const kakao = (window as any).kakao;

      if (!kakao?.maps?.load) {
        reject(new Error('Kakao 지도 SDK가 정상적으로 초기화되지 않았습니다.'));
        return;
      }

      kakao.maps.load(() => {
        if (kakao.maps.services?.Geocoder) {
          resolve(kakao);
          return;
        }

        reject(new Error('Kakao 좌표 변환 라이브러리를 찾지 못했습니다.'));
      });
    };

    script.onerror = () => {
      reject(new Error('Kakao 지도 SDK를 불러오지 못했습니다. 키 또는 도메인 등록 상태를 확인하세요.'));
    };

    document.head.appendChild(script);
  });
}

async function geocodeAddress(address: string) {
  const kakao = await loadKakaoMapsServicesScript();

  return new Promise<{ lat: string; lng: string }>((resolve, reject) => {
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(address, (results: any[], status: string) => {
      const okStatus = kakao.maps.services.Status?.OK ?? 'OK';

      if (status !== okStatus || !results?.[0]) {
        reject(new Error('주소로 좌표를 찾지 못했습니다. 위도/경도를 직접 입력해 주세요.'));
        return;
      }

      resolve({
        lat: String(results[0].y ?? ''),
        lng: String(results[0].x ?? ''),
      });
    });
  });
}

function loadDaumPostcodeScript() {
  return new Promise<any>((resolve, reject) => {
    const existingDaum = (window as any).daum;

    if (existingDaum?.Postcode) {
      resolve(existingDaum);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-kosmos-daum-postcode="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        const daum = (window as any).daum;
        if (daum?.Postcode) resolve(daum);
        else reject(new Error('주소 검색 스크립트 로드 후에도 Daum Postcode를 찾지 못했습니다.'));
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('주소 검색 스크립트를 불러오지 못했습니다.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.dataset.kosmosDaumPostcode = 'true';

    script.onload = () => {
      const daum = (window as any).daum;
      if (daum?.Postcode) resolve(daum);
      else reject(new Error('주소 검색 스크립트 로드 후에도 Daum Postcode를 찾지 못했습니다.'));
    };

    script.onerror = () => {
      reject(new Error('주소 검색 스크립트를 불러오지 못했습니다.'));
    };

    document.head.appendChild(script);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    image.src = src;
  });
}

async function resizeImageFile(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });

  const image = await loadImage(dataUrl);
  const maxSize = 1280;
  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.round(image.width * ratio);
  const height = Math.round(image.height * ratio);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 처리에 실패했습니다.');
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.78);
}

export function ParkingLotFormModal({
  open,
  value,
  accessToken,
  onClose,
  onSaved,
}: Props) {
  const editing = Boolean(value?.id);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setForm({
      code: value?.code ?? '',
      name: value?.name ?? '',
      region: value?.region ?? '',
      district: value?.district ?? '',
      representative: value?.representative ?? '',
      contact: formatKoreanPhoneNumber(value?.contact ?? ''),
      address: value?.address ?? '',
      lat: value?.lat == null ? '' : String(value.lat),
      lng: value?.lng == null ? '' : String(value.lng),
      operationMode: value?.operationMode === 'MANUAL' ? 'MANUAL' : 'SENSOR',
      photos: (value?.photos ?? []).map((photo) => photo.imageUrl).filter(Boolean),
    });
    setMessage(null);
  }, [open, value]);

  const canSave = useMemo(() => {
    return Boolean(form.code.trim() && form.name.trim() && normalizeAddressInput(form.address));
  }, [form.address, form.code, form.name]);

  if (!open) return null;

  function updateField(field: keyof FormState, fieldValue: string) {
    setForm((prev) => ({
      ...prev,
      [field]: fieldValue,
    }));
  }

  async function handlePhotoChange(files: FileList | null) {
    if (!files?.length) return;

    setPhotoLoading(true);
    setMessage(null);

    try {
      const selectedFiles = Array.from(files)
        .filter((file) => file.type.startsWith('image/'))
        .slice(0, 5);

      const images = await Promise.all(selectedFiles.map((file) => resizeImageFile(file)));

      setForm((prev) => ({
        ...prev,
        photos: [...prev.photos, ...images].slice(0, 5),
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '사진 처리에 실패했습니다.');
    } finally {
      setPhotoLoading(false);
    }
  }

  function removePhoto(index: number) {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, photoIndex) => photoIndex !== index),
    }));
  }

  async function applyAddressSelection(data: any) {
    const selectedAddress = normalizeAddressInput(data.roadAddress || data.jibunAddress || '');

    if (!selectedAddress) {
      setMessage('선택한 주소를 확인하지 못했습니다. 주소를 직접 입력해 주세요.');
      return;
    }

    setForm((prev) => ({
      ...prev,
      address: selectedAddress,
      region: normalizeSidoName(data.sido) || prev.region,
      district: normalizeSigunguName(data.sigungu) || prev.district,
    }));

    try {
      const coordinates = await geocodeAddress(selectedAddress);

      setForm((prev) => ({
        ...prev,
        lat: coordinates.lat,
        lng: coordinates.lng,
      }));

      setMessage('주소와 좌표가 입력되었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '좌표 자동 입력에 실패했습니다.');
    }
  }

  async function openAddressSearch() {
    setMessage(null);

    try {
      const daum = await loadDaumPostcodeScript();

      new daum.Postcode({
        oncomplete(data: any) {
          void applyAddressSelection(data);
        },
      }).open();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '주소 검색 스크립트를 불러오지 못했습니다. 주소를 직접 입력해 주세요.',
      );
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setMessage('로그인 세션이 없습니다. 다시 로그인해 주세요.');
      return;
    }

    if (!canSave) {
      setMessage('주차장 코드, 주차장명, 주소는 필수입니다.');
      return;
    }

    const address = normalizeAddressInput(form.address);

    if (address.length < 5) {
      setMessage('주소를 5자 이상 입력하거나 주소 검색을 사용하세요.');
      return;
    }

    const contactValidation = validateKoreanPhoneNumber(form.contact, {
      required: false,
    });

    if (!contactValidation.ok) {
      setMessage(contactValidation.message ?? '올바른 연락처 형식이 아닙니다.');
      return;
    }

    const lat = toNumberOrNull(form.lat);
    const lng = toNumberOrNull(form.lng);
    const coordinateMessage = getCoordinateMessage(lat, lng);

    if (coordinateMessage) {
      setMessage(coordinateMessage);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiFetch(editing ? `/facilities/lots/${value?.id}` : '/facilities/lots', {
        method: editing ? 'PATCH' : 'POST',
        accessToken,
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          region: form.region.trim() || null,
          district: form.district.trim() || null,
          representative: form.representative.trim() || null,
          contact: contactValidation.formatted || null,
          address,
          lat,
          lng,
          photos: form.photos,
          operationMode: form.operationMode === 'MANUAL' ? 'MANUAL' : 'SENSOR',
        }),
      });

      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '주차장 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {editing ? '주차장 수정' : '주차장 추가'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              주차장 기본 정보, 주소, 좌표, 사진을 입력합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
              <Field label="주차장 코드" required>
                <input
                  value={form.code}
                  onChange={(event) => updateField('code', event.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="LOT-001"
                  required
                />
              </Field>

              <Field label="주차장명" required>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="예: 개발주차장"
                  required
                />
              </Field>

              <Field label="운영 방식" required>
                <select
                  value={form.operationMode}
                  onChange={(event) => updateField('operationMode', event.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="SENSOR">센서 방식</option>
                  <option value="MANUAL">수동 방식</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  센서 방식은 기존 센서 입출차를 사용하고, 수동 방식은 운영자가 입차/출차를 직접 등록합니다.
                </p>
              </Field>

              <Field label="대표자">
                <input
                  value={form.representative}
                  onChange={(event) => updateField('representative', event.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="대표자명"
                />
              </Field>

              <Field label="연락처">
                <input
                  value={form.contact}
                  onChange={(event) => updateField('contact', formatKoreanPhoneNumber(event.target.value))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="010-0000-0000"
                  inputMode="tel"
                />
              </Field>
            </div>

            <Field label="주소" required>
              <div className="flex gap-2">
                <input
                  value={form.address}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      address: event.target.value,
                      region: '',
                      district: '',
                      lat: '',
                      lng: '',
                    }))
                  }
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="주소 검색을 눌러 도로명 주소를 선택하세요"
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className="shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  주소 검색
                </button>
              </div>
            </Field>

            <p className="-mt-2 text-xs font-semibold text-slate-500">
              주소 검색 결과에서 시/도, 시/군/구와 좌표를 자동 입력합니다. 오탈자 방지를 위해 지역 값은 직접 입력하지 않습니다.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="시/도">
                <input
                  value={form.region}
                  readOnly
                  className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                  placeholder="주소 검색 시 자동 입력"
                />
              </Field>

              <Field label="시/군/구">
                <input
                  value={form.district}
                  readOnly
                  className="w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                  placeholder="주소 검색 시 자동 입력"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="위도" required>
                <input
                  value={form.lat}
                  onChange={(event) => updateField('lat', event.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="37.4979"
                  inputMode="decimal"
                />
              </Field>

              <Field label="경도" required>
                <input
                  value={form.lng}
                  onChange={(event) => updateField('lng', event.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="127.0276"
                  inputMode="decimal"
                />
              </Field>
            </div>

            <p className="-mt-2 text-xs font-semibold text-slate-500">
              좌표가 자동 입력되지 않으면 위도/경도를 직접 입력할 수 있습니다.
            </p>

            <section className="rounded-2xl border bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">주차장 사진</h3>
                <p className="mt-1 text-xs text-slate-500">
                  최대 5장까지 등록할 수 있습니다. 업로드 시 자동으로 압축됩니다.
                </p>
              </div>

              <label className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                사진 선택
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void handlePhotoChange(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            {photoLoading ? (
              <p className="mt-3 text-sm text-slate-500">사진 처리 중...</p>
            ) : null}

            {form.photos.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {form.photos.map((photo, index) => (
                  <div key={`${photo.slice(0, 30)}-${index}`} className="overflow-hidden rounded-2xl border bg-white">
                    <img
                      src={photo}
                      alt={`주차장 사진 ${index + 1}`}
                      className="h-32 w-full object-cover"
                    />
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-slate-500">
                        {index === 0 ? '대표 사진' : `사진 ${index + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed bg-white p-4 text-center text-sm text-slate-500">
                등록된 사진이 없습니다.
              </p>
            )}
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              취소
            </button>

            <button
              type="submit"
              disabled={!canSave || saving || photoLoading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
