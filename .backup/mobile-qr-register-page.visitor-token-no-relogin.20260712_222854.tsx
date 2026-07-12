'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE =
  getPublicApiBaseUrl();

type Props = {
  qrToken: string;
  initialSpaceCode?: string;
};

type SpaceOption = {
  id: string;
  code: string;
  number?: string | null;
  type?: string | null;
  status?: string;
  lat?: number | null;
  lng?: number | null;
  widthMeter?: number | null;
  heightMeter?: number | null;
  rotationDeg?: number | null;
  activeSessionId?: string | null;
  entryTime?: string | null;
  section?: {
    id: string;
    name?: string;
    code?: string;
  };
};

type MemberVehicleItem = {
  id: string | null;
  plateNumber: string;
  vehicleType?: string | null;
  ownerName?: string | null;
  isPrimary?: boolean;
};

function getSpaceTypeLabel(type?: string | null) {
  switch (type) {
    case 'REGULAR':
      return '일반';
    case 'COMPACT':
      return '경차';
    case 'HANDICAPPED':
      return '장애인';
    case 'PREGNANT':
      return '임산부';
    case 'EV':
      return '전기차';
    case 'VIP':
      return 'VIP';
    case 'RESERVED':
      return '예약/지정';
    default:
      return type ?? '일반';
  }
}

function isSelectableSpaceType(type?: string | null) {
  return !type || type === 'REGULAR' || type === 'COMPACT';
}

function getRestrictionReason(type?: string | null) {
  if (isSelectableSpaceType(type)) return null;

  switch (type) {
    case 'HANDICAPPED':
      return '장애인 전용 주차면입니다.';
    case 'PREGNANT':
      return '임산부 배려 주차면입니다.';
    case 'EV':
      return '전기차 충전 주차면입니다.';
    case 'VIP':
      return 'VIP 전용 주차면입니다.';
    case 'RESERVED':
      return '예약/지정 주차면입니다.';
    default:
      return '선택 제한 주차면입니다.';
  }
}

function canSelectSpace(space: SpaceOption) {
  return (
    space.status === 'OCCUPIED_UNREGISTERED' &&
    isSelectableSpaceType(space.type)
  );
}

function getSpaceStatusLabel(space: SpaceOption) {
  if (canSelectSpace(space)) return '등록 가능';

  if (space.status === 'EMPTY') return '빈 주차면';

  if (space.status === 'OCCUPIED_UNREGISTERED') {
    return '등록 제한';
  }

  if (space.status === 'OCCUPIED' || space.status === 'OCCUPIED_REGISTERED') {
    return '등록 완료';
  }

  return space.status ?? '상태 미확인';
}

function getSpaceCardClass(space: SpaceOption, selected: boolean) {
  if (selected) {
    return 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200';
  }

  if (canSelectSpace(space)) {
    return 'border-emerald-200 bg-emerald-50';
  }

  if (space.status === 'EMPTY') {
    return 'border-slate-100 bg-slate-50 opacity-75';
  }

  if (space.status === 'OCCUPIED_UNREGISTERED') {
    return 'border-amber-200 bg-amber-50';
  }

  return 'border-blue-100 bg-blue-50 opacity-80';
}

function getSpaceBadgeClass(space: SpaceOption) {
  if (canSelectSpace(space)) return 'bg-emerald-600 text-white';
  if (space.status === 'EMPTY') return 'bg-slate-200 text-slate-600';
  if (space.status === 'OCCUPIED_UNREGISTERED') return 'bg-amber-500 text-white';
  return 'bg-blue-600 text-white';
}

function getMobileToken() {
  if (typeof window === 'undefined') return '';

  return localStorage.getItem('kosmos.mobileAccessToken') ?? '';
}

function getVisitorToken() {
  if (typeof window === 'undefined') return '';

  return localStorage.getItem('kosmos.visitorAccessToken') ?? '';
}

function getVisitorSession() {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem('kosmos.visitorSession');

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

function formatKoreanMobilePhone(value: string) {
  const digits = normalizePhoneDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function blockManualHyphen(event: any, setMessage: (message: string | null) => void) {
  if (event.key === '-') {
    event.preventDefault();
    setMessage('숫자만 입력하세요. 하이픈은 자동으로 입력됩니다.');
  }
}

function hasMobileMemberToken() {
  return Boolean(getMobileToken());
}

type MobileApiFetchOptions = RequestInit & {
  accessToken?: string | null;
  auth?: boolean;
};

async function apiFetch(path: string, options: MobileApiFetchOptions = {}) {
  const { accessToken, auth, ...fetchOptions } = options;
  const token =
    accessToken ?? (auth === false ? '' : getMobileToken() || getVisitorToken());

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers ?? {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(json?.message ?? text ?? '요청을 처리하지 못했습니다.');
  }

  return json;
}

export default function MobileQrRegisterPage({ qrToken, initialSpaceCode = '' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [spaceViewMode, setSpaceViewMode] = useState<'list' | 'grid' | 'map'>('list');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [registerMode, setRegisterMode] = useState<'visitor' | 'member'>('visitor');

  const [verificationCode, setVerificationCode] = useState('');
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [visitorPinCode, setVisitorPinCode] = useState('');
  const [visitorPinCodeConfirm, setVisitorPinCodeConfirm] = useState('');

  const [memberVehicles, setMemberVehicles] = useState<MemberVehicleItem[]>([]);
  const [memberUser, setMemberUser] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedPlateNumber, setSelectedPlateNumber] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberLoggedIn, setMemberLoggedIn] = useState(false);
  const [visitorLoggedIn, setVisitorLoggedIn] = useState(false);
  const [visitorSession, setVisitorSession] = useState<any>(null);

  const spaces: SpaceOption[] = useMemo(() => {
    const direct = detail?.parkingSpaces ?? detail?.spaces ?? [];
    const sections = detail?.parkingLot?.sections ?? detail?.sections ?? [];

    if (Array.isArray(direct) && direct.length) return direct;

    if (Array.isArray(sections)) {
      return sections.flatMap((section: any) =>
        (section?.spaces ?? section?.parkingSpaces ?? []).map((space: any) => ({
          ...space,
          section: {
            id: section.id,
            name: section.name,
            code: section.code,
          },
        })),
      );
    }

    return [];
  }, [detail]);

  const registerableSpaces = useMemo(
    () => spaces.filter((space) => canSelectSpace(space)),
    [spaces],
  );

  const restrictedSpaces = useMemo(
    () =>
      spaces.filter(
        (space) =>
          space.status === 'OCCUPIED_UNREGISTERED' &&
          !isSelectableSpaceType(space.type),
      ),
    [spaces],
  );

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId) ?? null,
    [spaces, selectedSpaceId],
  );

  async function load() {
    setLoading(true);
    setMessage(null);

    if (!qrToken) {
      setDetail(null);
      setSelectedSpaceId('');
      setLoading(false);
      setMessage('홈 지도에서 주차장을 선택한 후 주차 등록을 진행하세요.');
      return;
    }

    try {
      const json = await apiFetch(`/mobile/qr/${qrToken}`);
      setDetail(json);

      const sections = json?.parkingLot?.sections ?? json?.sections ?? [];
      const allSpaces = Array.isArray(json?.parkingSpaces)
        ? json.parkingSpaces
        : Array.isArray(json?.spaces)
          ? json.spaces
          : Array.isArray(sections)
            ? sections.flatMap((section: any) => section?.spaces ?? section?.parkingSpaces ?? [])
            : [];

      const matchingSpace = initialSpaceCode
        ? allSpaces.find((space: any) => space?.code === initialSpaceCode)
        : null;

      setSelectedSpaceId(matchingSpace && canSelectSpace(matchingSpace) ? matchingSpace.id : '');
    } catch (error: any) {
      setMessage(error?.message ?? '주차장 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  useEffect(() => {
    const token = getVisitorToken();
    const session = getVisitorSession();

    setVisitorLoggedIn(Boolean(token));
    setVisitorSession(session);

    const savedPhone =
      session?.phone ??
      session?.contactPhone ??
      session?.visitor?.phone ??
      session?.visitorProfile?.phone ??
      '';

    if (token && savedPhone) {
      setContactPhone(formatKoreanMobilePhone(String(savedPhone)));
      setPhoneVerified(true);
    }
  }, []);

  useEffect(() => {
    if (registerMode === 'member') {
      loadMemberVehicles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerMode]);

  function requestVerificationCode() {
    setMessage(null);

    if (!contactPhone.trim()) {
      setMessage('휴대폰 번호를 입력하세요.');
      return;
    }

    setVerificationRequested(true);
    setPhoneVerified(false);
    setMessage('인증번호를 발송했습니다. 테스트 단계에서는 123456을 입력하세요.');
  }

  function verifyPhoneCode() {
    setMessage(null);

    if (!verificationRequested) {
      setMessage('먼저 인증번호를 요청하세요.');
      return;
    }

    if (verificationCode.trim() !== '123456') {
      setMessage('인증번호가 올바르지 않습니다.');
      return;
    }

    setPhoneVerified(true);
    setMessage('휴대폰 인증이 완료되었습니다. 방문객 PIN을 입력하세요.');
  }

  async function loadMemberVehicles() {
    if (typeof window === 'undefined') return;

    const token = getMobileToken();

    if (!token) {
      setMemberLoggedIn(false);
      setMemberUser(null);
      setMemberVehicles([]);
      setSelectedVehicleId('');
      setSelectedPlateNumber('');
      setMemberLoading(false);
      return;
    }

    setMemberLoading(true);

    try {
      const data = await apiFetch('/mobile/member/vehicles', {
        accessToken: token,
      });

      const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
      setMemberLoggedIn(true);
      setMemberUser(data?.user ?? null);
      setMemberVehicles(vehicles);

      if (vehicles.length > 0) {
        const primary =
          vehicles.find((item: MemberVehicleItem) => item.isPrimary) ?? vehicles[0];

        setSelectedVehicleId(primary?.id ?? '');
        setSelectedPlateNumber(primary?.plateNumber ?? '');
      } else {
        setSelectedVehicleId('');
        setSelectedPlateNumber('');
      }
    } catch (error: any) {
      setMemberLoggedIn(false);
      setMemberUser(null);
      setMemberVehicles([]);
      setSelectedVehicleId('');
      setSelectedPlateNumber('');
      setMessage(error?.message ?? '회원 차량 정보를 불러오지 못했습니다.');
    } finally {
      setMemberLoading(false);
    }
  }

  async function submit() {
    setMessage(null);

    if (!selectedSpaceId) {
      setMessage('주차면을 선택하세요.');
      return;
    }

    if (registerMode === 'member') {
      const token = getMobileToken();

      if (!token) {
        const next = encodeURIComponent(`/mobile/qr/${qrToken}`);
        window.location.href = `/mobile/member/login?next=${next}`;
        return;
      }

      if (!selectedVehicleId && !selectedPlateNumber) {
        setMessage('등록 차량을 선택하세요.');
        return;
      }

      setSaving(true);

      try {
        const result = await apiFetch(`/mobile/qr/${qrToken}/register-member`, {
          method: 'POST',
          accessToken: token,
          body: JSON.stringify({
            parkingSpaceId: selectedSpaceId,
            vehicleId: selectedVehicleId || undefined,
            plateNumber: selectedVehicleId ? undefined : selectedPlateNumber,
          }),
        });

        const selectedSpace = spaces.find((space) => space.id === selectedSpaceId);
        const currentParkingSessionId =
          result?.sessionId ??
          result?.parkingSessionId ??
          result?.session?.id ??
          result?.parkingSession?.id ??
          selectedSpace?.activeSessionId ??
          '';

        if (currentParkingSessionId && typeof window !== 'undefined') {
          localStorage.setItem('kosmos.currentParkingSessionId', currentParkingSessionId);
        }

        await load();
        setMessage('회원 주차 등록이 완료되었습니다. 현재 주차 화면으로 이동합니다.');
        window.setTimeout(() => {
          router.push('/mobile/parking/current');
        }, 1000);
        return;
      } catch (error: any) {
        setMessage(error?.message ?? '회원 주차 등록에 실패했습니다.');
        return;
      } finally {
        setSaving(false);
      }
    }

    if (!vehiclePlateNumber.trim()) {
      setMessage('차량번호를 입력하세요.');
      return;
    }

    const visitorToken = getVisitorToken();
    const visitorSessionNow = getVisitorSession();
    const visitorAlreadyLoggedIn = Boolean(visitorToken);

    const sessionPhone =
      visitorSessionNow?.phone ??
      visitorSessionNow?.contactPhone ??
      visitorSessionNow?.visitor?.phone ??
      visitorSessionNow?.visitorProfile?.phone ??
      '';

    const submitPhone = contactPhone.trim() || String(sessionPhone ?? '').trim();

    if (!submitPhone) {
      setMessage('방문객 연락처 정보를 확인할 수 없습니다. 방문객 로그인 후 다시 시도하세요.');
      return;
    }

    let normalizedVisitorPinCode = visitorPinCode.trim();

    if (!visitorAlreadyLoggedIn) {
      if (!contactPhone.trim()) {
        setMessage('방문자 등록은 연락처를 입력해야 합니다.');
        return;
      }

      if (!phoneVerified) {
        setMessage('휴대폰 인증을 완료하세요.');
        return;
      }

      const normalizedVisitorPinCodeConfirm = visitorPinCodeConfirm.trim();

      if (!/^\d{4,6}$/.test(normalizedVisitorPinCode)) {
        setMessage('방문객 PIN은 4~6자리 숫자로 입력하세요.');
        return;
      }

      if (normalizedVisitorPinCode !== normalizedVisitorPinCodeConfirm) {
        setMessage('방문객 PIN 확인이 일치하지 않습니다.');
        return;
      }
    }

    setSaving(true);

    try {
      const result = await apiFetch(`/mobile/qr/${qrToken}/register-visitor`, {
        method: 'POST',
        body: JSON.stringify({
          parkingSpaceId: selectedSpaceId,
          vehiclePlateNumber: vehiclePlateNumber.trim(),
          phone: formatKoreanMobilePhone(submitPhone),
          contactPhone: formatKoreanMobilePhone(submitPhone),
          phoneVerificationCode: visitorAlreadyLoggedIn ? undefined : verificationCode.trim(),
          phoneVerified: visitorAlreadyLoggedIn ? true : phoneVerified,
          pinCode: visitorAlreadyLoggedIn ? undefined : normalizedVisitorPinCode,
        }),
      });

      let visitorToken =
        result?.visitorAccessToken ??
        result?.accessToken ??
        result?.token ??
        result?.auth?.accessToken ??
        '';

      if (!visitorToken) {
        const loginResult = await apiFetch('/mobile/visitor/login', {
          method: 'POST',
          body: JSON.stringify({
            phone: formatKoreanMobilePhone(contactPhone),
            pinCode: normalizedVisitorPinCode,
          }),
        });

        visitorToken =
          loginResult?.accessToken ??
          loginResult?.visitorAccessToken ??
          loginResult?.token ??
          '';
      }

      if (visitorToken && typeof window !== 'undefined') {
        localStorage.setItem('kosmos.visitorAccessToken', visitorToken);
      }

      const selectedSpace = spaces.find((space) => space.id === selectedSpaceId);
      const currentParkingSessionId =
        result?.sessionId ??
        result?.parkingSessionId ??
        result?.session?.id ??
        result?.parkingSession?.id ??
        selectedSpace?.activeSessionId ??
        '';

      if (currentParkingSessionId && typeof window !== 'undefined') {
        localStorage.setItem('kosmos.currentParkingSessionId', currentParkingSessionId);
      }

      await load();

      if (visitorToken) {
        setMessage('방문객 주차 등록이 완료되었습니다. 현재 주차 화면으로 이동합니다.');

        window.setTimeout(() => {
          router.push('/mobile/parking/current');
        }, 1200);
      } else {
        setMessage('방문객 주차 등록은 완료되었습니다. 결제/영수증 확인 시 방문객 PIN으로 로그인하세요.');

        window.setTimeout(() => {
          router.push(`/mobile/visitor/login?next=${encodeURIComponent('/mobile/parking/current')}`);
        }, 1500);
      }
    } catch (error: any) {
      setMessage(error?.message ?? '방문객 주차 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const lot = detail?.parkingLot ?? detail?.lot ?? detail;
  const mobileMemberLoggedIn = memberLoggedIn && hasMobileMemberToken();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-300">
              KOSMOS PARKING
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight">
              주차 등록
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              입차가 감지되었지만 아직 등록되지 않은 주차면을 선택하고 차량 정보를 등록하세요.
            </p>
          </div>

          {loading ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
              QR 정보를 불러오는 중입니다.
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">주차장</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {lot?.name ?? '-'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {lot?.address ?? lot?.region ?? ''}
                </p>
              </div>

              <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-black text-blue-900">
                  이미 등록했거나 결제/영수증을 확인하시나요?
                </p>
                <p className="mt-1 text-xs font-bold text-blue-700">
                  같은 QR을 다시 스캔한 경우 로그인 후 현재 주차, 결제, 영수증을 확인할 수 있습니다.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={`/mobile/visitor/login?next=${encodeURIComponent('/mobile/payments')}`}
                    className="rounded-2xl bg-white px-3 py-3 text-center text-xs font-black text-blue-700 ring-1 ring-blue-100"
                  >
                    방문객 PIN 로그인
                  </a>
                  <a
                    href={`/mobile/member/login?next=${encodeURIComponent('/mobile/payments')}`}
                    className="rounded-2xl bg-blue-600 px-3 py-3 text-center text-xs font-black text-white"
                  >
                    회원 로그인
                  </a>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 rounded-3xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setRegisterMode('visitor')}
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    registerMode === 'visitor'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  방문자
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterMode('member')}
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    registerMode === 'member'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  회원
                </button>
              </div>

              {registerMode === 'member' ? (
                selectedSpace ? (
                  <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
                    <p className="text-xs font-black text-emerald-600">
                      선택한 주차면
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {selectedSpace.section?.name || selectedSpace.section?.code
                        ? `${selectedSpace.section?.name ?? selectedSpace.section?.code} · `
                        : ''}
                      {selectedSpace.code}
                    </p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">
                      {getSpaceTypeLabel(selectedSpace.type)} · 입차 감지됨 · 등록 필요
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                    먼저 입차 감지 · 등록 필요 주차면을 선택하세요. 주차면을 선택하면 회원 로그인/차량 선택 영역이 표시됩니다.
                  </div>
                )
              ) : null}

              {registerMode === 'member' && selectedSpace ? (
                <div className="mt-5 space-y-4">

                  {!mobileMemberLoggedIn ? (
                    <div className="rounded-3xl bg-blue-50 p-4 text-sm text-blue-700">
                      <p className="font-black">회원 로그인이 필요합니다.</p>
                      <p className="mt-1">
                        로그인 후 등록 차량을 선택해 주차 등록합니다.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <a
                          href={`/mobile/member/login?next=${encodeURIComponent(`/mobile/qr/${qrToken}`)}`}
                          className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white"
                        >
                          로그인
                        </a>
                        <a
                          href="/mobile/member/signup"
                          className="flex-1 rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-blue-700 ring-1 ring-blue-100"
                        >
                          회원가입
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl bg-blue-50 p-4 text-sm text-blue-700">
                      <p className="text-xs font-bold text-blue-500">회원</p>
                      <p className="mt-1 text-base font-black text-slate-900">
                        {memberUser?.name ?? memberUser?.phone ?? '회원'}
                      </p>
                      <p className="mt-1 text-xs text-blue-700">
                        등록 차량을 선택해 입차 감지된 주차면에 등록합니다.
                      </p>

                      <label className="mt-4 block">
                        <span className="text-xs font-bold text-slate-500">
                          등록 차량
                        </span>
                        <select
                          value={selectedVehicleId || selectedPlateNumber}
                          onChange={(event) => {
                            const value = event.target.value;
                            const vehicle = memberVehicles.find(
                              (item) => (item.id ?? item.plateNumber) === value,
                            );

                            setSelectedVehicleId(vehicle?.id ?? '');
                            setSelectedPlateNumber(vehicle?.plateNumber ?? '');
                          }}
                          className="mt-2 w-full rounded-2xl border border-blue-100 bg-white px-4 py-4 text-base font-bold text-slate-900 outline-none focus:border-blue-500"
                        >
                          <option value="">등록 차량 선택</option>
                          {memberVehicles.map((vehicle) => (
                            <option
                              key={vehicle.id ?? vehicle.plateNumber}
                              value={vehicle.id ?? vehicle.plateNumber}
                            >
                              {vehicle.plateNumber}
                              {vehicle.isPrimary ? ' · 대표' : ''}
                            </option>
                          ))}
                        </select>
                      </label>

                      {memberLoading ? (
                        <p className="mt-2 text-xs font-bold text-blue-500">
                          등록 차량을 불러오는 중입니다.
                        </p>
                      ) : null}

                      {!memberLoading && memberVehicles.length === 0 ? (
                        <p className="mt-2 text-xs font-bold text-red-500">
                          등록 차량이 없습니다. 회원가입 또는 차량 추가 후 이용하세요.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-400">
                      입차 감지 · 등록 필요 주차면
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      입차 감지 후 아직 주차 등록되지 않은 주차면만 표시합니다.
                    </p>
                  </div>
                  <a
                    href={`/mobile/parking/spaces?qrToken=${encodeURIComponent(qrToken)}`}
                    className="shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
                  >
                    전체 보기
                  </a>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black">
                  <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-emerald-100">
                    초록 · 등록 가능
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-700 ring-1 ring-amber-100">
                    주황 · 제한 유형
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {registerableSpaces.map((space) => (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => setSelectedSpaceId(space.id)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${getSpaceCardClass(
                        space,
                        selectedSpaceId === space.id,
                      )}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-black ${getSpaceBadgeClass(
                            space,
                          )}`}
                        >
                          {getSpaceStatusLabel(space)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-700 ring-1 ring-slate-100">
                          {getSpaceTypeLabel(space.type)}
                        </span>
                      </span>

                      <span className="mt-2 block text-base font-black text-slate-950">
                        {space.section?.name || space.section?.code
                          ? `${space.section?.name ?? space.section?.code} · `
                          : ''}
                        {space.code}
                      </span>
                    </button>
                  ))}
                </div>

                {registerableSpaces.length === 0 ? (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-4 text-sm font-bold text-amber-700">
                    현재 등록 가능한 미등록 입차 주차면이 없습니다.
                    이미 등록했다면 위의 방문객 PIN 로그인 또는 회원 로그인을 통해 결제/영수증을 확인하세요.
                  </div>
                ) : null}

                {restrictedSpaces.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 px-4 py-4 text-sm">
                    <p className="font-black text-slate-700">
                      선택 제한 주차면
                    </p>
                    {restrictedSpaces.map((space) => (
                      <div
                        key={space.id}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900">
                            {space.section?.name || space.section?.code
                              ? `${space.section?.name ?? space.section?.code} · `
                              : ''}
                            {space.code}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                            {getSpaceTypeLabel(space.type)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {getRestrictionReason(space.type)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {registerMode === 'visitor' ? (
                selectedSpace ? (
                  <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
                    <p className="text-xs font-black text-emerald-600">
                      선택한 주차면
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {selectedSpace.section?.name || selectedSpace.section?.code
                        ? `${selectedSpace.section?.name ?? selectedSpace.section?.code} · `
                        : ''}
                      {selectedSpace.code}
                    </p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">
                      {getSpaceTypeLabel(selectedSpace.type)} · 입차 감지됨 · 등록 필요
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                    먼저 입차 감지 · 등록 필요 주차면을 선택하세요. 주차면을 선택하면 차량번호, 연락처, 방문객 PIN 입력폼이 표시됩니다.
                  </div>
                )
              ) : null}

              {registerMode === 'visitor' && selectedSpace ? (
                <div className="mt-5 space-y-4">
                  {/* 방문객 입력 영역 시작 */}
                  {registerMode === 'visitor' ? (
                    <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                      <p className="font-black text-slate-900">방문객 이용 안내</p>
                      <p className="mt-1">
                        {visitorLoggedIn
                          ? '방문객 PIN 로그인 상태입니다. 차량번호만 입력하면 주차 등록을 진행할 수 있습니다.'
                          : '처음 이용하는 방문객은 차량번호, 휴대폰 인증, 방문객 PIN 설정 후 주차 등록합니다.'}
                      </p>
                      {!visitorLoggedIn ? (
                        <a
                          href={`/mobile/visitor/login?next=${encodeURIComponent(`/mobile/qr/${qrToken}`)}`}
                          className="mt-3 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-blue-700 ring-1 ring-blue-100"
                        >
                          이미 방문객 PIN이 있나요? 방문객 로그인
                        </a>
                      ) : (
                        <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-700 ring-1 ring-emerald-100">
                          방문객 로그인 확인됨
                        </div>
                      )}
                    </div>
                  ) : null}

                  <label className="mt-4 block">
                    <span className="text-xs font-bold text-slate-400">차량번호</span>
                    <input
                      value={vehiclePlateNumber}
                      onChange={(event) => setVehiclePlateNumber(event.target.value)}
                      placeholder="예: 12가3456"
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="text-xs font-bold text-slate-400">연락처</span>
                    <input
                      value={contactPhone}
                      onKeyDown={(event) => blockManualHyphen(event, setMessage)}
                      onChange={(event) => {
                        setContactPhone(formatKoreanMobilePhone(event.target.value));
                        setPhoneVerified(false);
                        setVerificationRequested(false);
                        setVerificationCode('');
                      }}
                      placeholder="예: 01029831136"
                      inputMode="numeric"
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
                    />
                    <p className="mt-2 text-xs font-bold text-slate-400">
                      숫자만 입력하세요. 하이픈은 자동으로 입력됩니다.
                    </p>
                  </label>

                  {registerMode === 'visitor' && !visitorLoggedIn ? (
                    <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={requestVerificationCode}
                          className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white"
                        >
                          인증번호 요청
                        </button>
                        <div className={`flex items-center rounded-2xl px-4 py-3 text-xs font-black ${
                          phoneVerified
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-white text-slate-400'
                        }`}>
                          {phoneVerified ? '인증 완료' : '미인증'}
                        </div>
                      </div>

                      {verificationRequested ? (
                        <div className="mt-3 flex gap-2">
                          <input
                            value={verificationCode}
                            onChange={(event) => setVerificationCode(event.target.value)}
                            placeholder="인증번호 6자리"
                            inputMode="numeric"
                            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={verifyPhoneCode}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
                          >
                            확인
                          </button>
                        </div>
                      ) : null}

                      <p className="mt-3 text-xs text-slate-400">
                        실제 SMS API 연결 전까지 테스트 인증번호는 123456입니다.
                      </p>
                    </div>
                  ) : null}

                  {/* 방문객 입력 영역 끝 */}
                </div>
              ) : null}

              {registerMode === 'visitor' && selectedSpace && !visitorLoggedIn ? (
                <div
                  data-kosmos-visitor-pin-form
                  className="mt-5 grid grid-cols-1 gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4"
                >
                  <label className="block">
                    <span className="text-xs font-bold text-slate-400">
                      방문객 PIN
                    </span>
                    <input
                      value={visitorPinCode}
                      onChange={(event) => setVisitorPinCode(event.target.value)}
                      placeholder="4~6자리 숫자"
                      inputMode="numeric"
                      type="password"
                      maxLength={6}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-400">
                      방문객 PIN 확인
                    </span>
                    <input
                      value={visitorPinCodeConfirm}
                      onChange={(event) => setVisitorPinCodeConfirm(event.target.value)}
                      placeholder="PIN 다시 입력"
                      inputMode="numeric"
                      type="password"
                      maxLength={6}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
                    />
                  </label>

                  <p className="text-xs font-bold text-slate-400">
                    방문객 로그인과 출차/결제 확인에 사용할 PIN입니다.
                  </p>
                </div>
              ) : null}

              {message ? (
                <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-700">
                  <p>{message}</p>
                  {!qrToken ? (
                    <a
                      href="/mobile"
                      className="mt-3 block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white"
                    >
                      홈 지도에서 주차장 선택
                    </a>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {saving ? '등록 중...' : '주차 등록하기'}
              </button>
            </>
          )}
        </section>


      </div>
    </main>
  );
}
