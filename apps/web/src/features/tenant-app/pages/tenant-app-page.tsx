'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { TenantCouponPanel, type TenantCouponView } from '../components/tenant-coupon-panel';

const TENANT_APP_TOKEN_KEY = 'kosmos.tenantVisit.accessToken';

type AppTab =
  | 'login'
  | 'apply'
  | 'visitRegister'
  | 'visitHistory'
  | 'couponPurchase'
  | 'couponInventory'
  | 'couponAssign'
  | 'couponAssignments'
  | 'profile';

type ParkingLot = {
  id: string;
  name: string;
  code: string;
  region?: string | null;
  isActive?: boolean;
  managementCompanyId?: string | null;
  managementCompanyName?: string | null;
  managementCompanyCode?: string | null;
};

type TenantForApp = {
  id: string;
  name: string;
  code: string;
  businessNumber?: string | null;
  representative?: string | null;
  contact?: string | null;
  billingEmail?: string | null;
  isActive?: boolean;
  parkingLotId?: string | null;
  parkingLotName?: string | null;
  parkingLotCode?: string | null;
  managementCompanyId?: string | null;
  managementCompanyName?: string | null;
  managementCompanyCode?: string | null;
};

type ApplicationResult = {
  id: string;
  status: string;
  companyName: string;
  parkingLotName?: string | null;
  createdAt?: string;
};

type LoginResponse = {
  ok: true;
  accessToken: string;
  tenant: TenantForApp;
};

type MeResponse = {
  ok: true;
  credential: {
    id: string;
    businessNumber: string;
    lastLoginAt?: string | null;
    pinUpdatedAt?: string | null;
  };
  tenant: TenantForApp;
};

type VisitSearchItem = {
  id: string;
  sessionNo?: string | null;
  status?: string | null;
  plateNumber?: string | null;
  contactPhone?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  parkingLotId?: string | null;
  parkingSectionId?: string | null;
  parkingSpaceId?: string | null;
  sectionCode?: string | null;
  spaceCode?: string | null;
  alreadyConfirmed: boolean;
};

type VisitHistoryItem = {
  id: string;
  parkingSessionId: string;
  sessionNo?: string | null;
  confirmedAt?: string | null;
  plateNumber?: string | null;
  contactPhone?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  graceUntil?: string | null;
  sectionCode?: string | null;
  spaceCode?: string | null;
  note?: string | null;
  status?: string | null;
};

type VisitSearchResponse = {
  ok: true;
  items: VisitSearchItem[];
};

type VisitHistoryResponse = {
  ok: true;
  items: VisitHistoryItem[];
};

type ConfirmVisitResponse = {
  ok: true;
  alreadyConfirmed: boolean;
  confirmation: {
    id: string;
    tenantId?: string;
    tenantName?: string;
    parkingSessionId?: string;
    sessionNo?: string | null;
    plateNumber?: string | null;
    contactPhone?: string | null;
    spaceCode?: string | null;
    sectionCode?: string | null;
    confirmedAt?: string | null;
    graceUntil?: string | null;
  };
};

const VISIT_TABS: AppTab[] = ['visitRegister', 'visitHistory'];
const COUPON_PURCHASE_TABS: AppTab[] = ['couponPurchase', 'couponInventory'];
const COUPON_ASSIGN_TABS: AppTab[] = ['couponAssign', 'couponAssignments'];
const COUPON_TABS: AppTab[] = [
  ...COUPON_PURCHASE_TABS,
  ...COUPON_ASSIGN_TABS,
];

function isVisitTab(tab: AppTab) {
  return VISIT_TABS.includes(tab);
}

function isCouponPurchaseTab(tab: AppTab) {
  return COUPON_PURCHASE_TABS.includes(tab);
}

function isCouponAssignTab(tab: AppTab) {
  return COUPON_ASSIGN_TABS.includes(tab);
}

function isCouponTab(tab: AppTab) {
  return COUPON_TABS.includes(tab);
}

function couponViewForTab(tab: AppTab): TenantCouponView | null {
  if (tab === 'couponPurchase') return 'purchase';
  if (tab === 'couponInventory') return 'inventory';
  if (tab === 'couponAssign') return 'assign';
  if (tab === 'couponAssignments') return 'assignments';
  return null;
}

function normalizeCode(value: string) {
  return value.trim();
}

function validateBusinessNumber(value: string) {
  const raw = value.trim();

  if (raw.includes('-')) {
    return '사업자등록번호는 하이픈(-) 없이 숫자만 입력해 주세요.';
  }

  if (!/^\d{10}$/.test(raw)) {
    return '사업자등록번호는 숫자 10자리로 입력해 주세요. 예: 5078117904';
  }

  return null;
}

function validatePin(value: string, label = 'PIN') {
  if (!/^\d{4,6}$/.test(value.trim())) {
    return `${label}은 숫자 4~6자리로 입력해 주세요.`;
  }

  return null;
}

function todayDateInputValue() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export function TenantAppPage() {
  const searchParams = useSearchParams();

  const initialCode = useMemo(() => {
    return normalizeCode(searchParams.get('code') ?? searchParams.get('parkingLotCode') ?? '');
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<AppTab>('login');
  const [menuOpen, setMenuOpen] = useState(false);

  const [parkingLotCode, setParkingLotCode] = useState(initialCode);
  const [parkingLot, setParkingLot] = useState<ParkingLot | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [representative, setRepresentative] = useState('');
  const [contact, setContact] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [pin, setPin] = useState('');
  const [memo, setMemo] = useState('');

  const [loginBusinessNumber, setLoginBusinessNumber] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [tenantToken, setTenantToken] = useState('');
  const [tenantMe, setTenantMe] = useState<MeResponse | null>(null);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const [visitQuery, setVisitQuery] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [visitSearchItems, setVisitSearchItems] = useState<VisitSearchItem[]>([]);
  const [visitHistoryDate, setVisitHistoryDate] = useState(todayDateInputValue());
  const [visitHistoryQuery, setVisitHistoryQuery] = useState('');
  const [visitHistoryItems, setVisitHistoryItems] = useState<VisitHistoryItem[]>([]);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [meLoading, setMeLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [visitSearchLoading, setVisitSearchLoading] = useState(false);
  const [visitHistoryLoading, setVisitHistoryLoading] = useState(false);
  const [visitConfirmLoadingId, setVisitConfirmLoadingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ApplicationResult | null>(null);

  const isLoggedIn = Boolean(tenantToken && tenantMe?.tenant);

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  async function lookupParkingLot(nextCode?: string) {
    const code = normalizeCode(nextCode ?? parkingLotCode);

    if (!code) {
      setError('주차장 코드를 입력해 주세요.');
      setParkingLot(null);
      return;
    }

    setLookupLoading(true);
    clearMessages();

    try {
      const data = await apiFetch<{ ok: true; parkingLot: ParkingLot }>(
        `/tenant-app/parking-lots/by-code/${encodeURIComponent(code)}`,
      );

      setParkingLot(data.parkingLot);
      setParkingLotCode(data.parkingLot.code);
    } catch (err) {
      setParkingLot(null);
      setError(err instanceof Error ? err.message : '주차장을 찾을 수 없습니다.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function submitApplication() {
    if (!parkingLot) {
      setError('먼저 주차장을 선택해 주세요.');
      return;
    }

    if (!companyName.trim()) {
      setError('입주사명을 입력해 주세요.');
      return;
    }

    const businessNumberError = validateBusinessNumber(businessNumber);
    if (businessNumberError) {
      setError(businessNumberError);
      return;
    }

    const pinError = validatePin(pin);
    if (pinError) {
      setError(pinError);
      return;
    }

    setSubmitLoading(true);
    clearMessages();
    setResult(null);

    try {
      const data = await apiFetch<{ ok: true; application: ApplicationResult }>('/tenant-app/applications', {
        method: 'POST',
        body: JSON.stringify({
          parkingLotId: parkingLot.id,
          parkingLotCode: parkingLot.code,
          companyName: companyName.trim(),
          businessNumber: businessNumber.trim(),
          representative: representative.trim() || undefined,
          contact: contact.trim() || undefined,
          billingEmail: billingEmail.trim() || undefined,
          pin: pin.trim(),
          memo: memo.trim() || undefined,
        }),
      });

      setResult(data.application);
      setNotice('입주사 신청이 접수되었습니다. 관리자 또는 매니저 승인 후 로그인할 수 있습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '입주사 신청에 실패했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function refreshMe(token?: string) {
    const accessToken = token ?? tenantToken;

    if (!accessToken) {
      setTenantMe(null);
      return;
    }

    setMeLoading(true);
    setError(null);

    try {
      const data = await apiFetch<MeResponse>('/tenant-app/me', {
        accessToken,
      });

      setTenantMe(data);
      setTenantToken(accessToken);
      window.localStorage.setItem(TENANT_APP_TOKEN_KEY, accessToken);
    } catch (err) {
      setTenantMe(null);
      setTenantToken('');
      window.localStorage.removeItem(TENANT_APP_TOKEN_KEY);
      setError(err instanceof Error ? err.message : '입주사 로그인 상태를 확인하지 못했습니다.');
    } finally {
      setMeLoading(false);
    }
  }

  async function login() {
    const businessNumberError = validateBusinessNumber(loginBusinessNumber);
    if (businessNumberError) {
      setError(businessNumberError);
      return;
    }

    const pinError = validatePin(loginPin);
    if (pinError) {
      setError(pinError);
      return;
    }

    setLoginLoading(true);
    clearMessages();

    try {
      const data = await apiFetch<LoginResponse>('/tenant-app/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          businessNumber: loginBusinessNumber.trim(),
          pin: loginPin.trim(),
        }),
      });

      setTenantToken(data.accessToken);
      window.localStorage.setItem(TENANT_APP_TOKEN_KEY, data.accessToken);
      setTenantMe({
        ok: true,
        credential: {
          id: '',
          businessNumber: data.tenant.businessNumber ?? loginBusinessNumber.trim(),
          lastLoginAt: null,
          pinUpdatedAt: null,
        },
        tenant: data.tenant,
      });
      setLoginPin('');
      setNotice(`${data.tenant.name} 입주사로 로그인되었습니다.`);
      setActiveTab('visitRegister');
      await refreshMe(data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    setTenantToken('');
    setTenantMe(null);
    setCurrentPin('');
    setNewPin('');
    setVisitQuery('');
    setVisitNote('');
    setVisitSearchItems([]);
    setVisitHistoryDate(todayDateInputValue());
    setVisitHistoryQuery('');
    setVisitHistoryItems([]);
    window.localStorage.removeItem(TENANT_APP_TOKEN_KEY);
    setNotice('로그아웃되었습니다.');
    setActiveTab('login');
  }

  async function searchVisits() {
    if (!tenantToken) {
      setError('입주사 로그인이 필요합니다.');
      setActiveTab('login');
      return;
    }

    const keyword = visitQuery.trim();
    const digits = keyword.replace(/\D/g, '');

    if (keyword.length < 2 && digits.length < 3) {
      setError('차량번호는 2글자 이상, 연락처는 숫자 3자리 이상 입력해 주세요.');
      return;
    }

    setVisitSearchLoading(true);
    clearMessages();

    try {
      const data = await apiFetch<VisitSearchResponse>(
        '/tenant-app/visits/search?q=' + encodeURIComponent(keyword),
        {
          accessToken: tenantToken,
        },
      );

      setVisitSearchItems(data.items);

      if (data.items.length === 0) {
        setNotice('검색 결과가 없습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '방문 차량 검색에 실패했습니다.');
    } finally {
      setVisitSearchLoading(false);
    }
  }

  async function confirmVisit(item: VisitSearchItem) {
    if (!tenantToken) {
      setError('입주사 로그인이 필요합니다.');
      setActiveTab('login');
      return;
    }

    if (item.alreadyConfirmed) {
      setNotice('이미 방문 등록된 차량입니다.');
      return;
    }

    setVisitConfirmLoadingId(item.id);
    clearMessages();

    try {
      const data = await apiFetch<ConfirmVisitResponse>(
        '/tenant-app/visits/' + encodeURIComponent(item.id) + '/confirm',
        {
          accessToken: tenantToken,
          method: 'POST',
          body: JSON.stringify({
            note: visitNote.trim() || undefined,
          }),
        },
      );

      setVisitSearchItems((items) =>
        items.map((row) =>
          row.id === item.id
            ? {
                ...row,
                alreadyConfirmed: true,
                status: 'PAID',
              }
            : row,
        ),
      );

      setNotice(data.alreadyConfirmed ? '이미 방문 등록된 차량입니다.' : '방문 등록이 완료되었습니다.');
      setVisitNote('');
      await loadVisitHistory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방문 등록에 실패했습니다.');
    } finally {
      setVisitConfirmLoadingId(null);
    }
  }

  async function loadVisitHistory(showLoading = true) {
    if (!tenantToken) {
      setVisitHistoryItems([]);
      return;
    }

    if (showLoading) {
      setVisitHistoryLoading(true);
    }

    setError(null);

    try {
      const params = new URLSearchParams();

      if (visitHistoryDate) {
        params.set('date', visitHistoryDate);
      }

      if (visitHistoryQuery.trim()) {
        params.set('q', visitHistoryQuery.trim());
      }

      const data = await apiFetch<VisitHistoryResponse>(
        '/tenant-app/visits/history?' + params.toString(),
        {
          accessToken: tenantToken,
        },
      );

      setVisitHistoryItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방문 이력을 불러오지 못했습니다.');
    } finally {
      if (showLoading) {
        setVisitHistoryLoading(false);
      }
    }
  }

  async function changePin() {
    if (!tenantToken) {
      setError('입주사 로그인이 필요합니다.');
      setActiveTab('login');
      return;
    }

    const currentPinError = validatePin(currentPin, '현재 PIN');
    if (currentPinError) {
      setError(currentPinError);
      return;
    }

    const newPinError = validatePin(newPin, '새 PIN');
    if (newPinError) {
      setError(newPinError);
      return;
    }

    if (currentPin.trim() === newPin.trim()) {
      setError('새 PIN은 현재 PIN과 다르게 입력해 주세요.');
      return;
    }

    setPinLoading(true);
    clearMessages();

    try {
      await apiFetch('/tenant-app/auth/change-pin', {
        accessToken: tenantToken,
        method: 'POST',
        body: JSON.stringify({
          currentPin: currentPin.trim(),
          newPin: newPin.trim(),
        }),
      });

      setCurrentPin('');
      setNewPin('');
      setNotice('PIN이 변경되었습니다.');
      await refreshMe(tenantToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN 변경에 실패했습니다.');
    } finally {
      setPinLoading(false);
    }
  }

  function moveTab(tab: AppTab) {
    setMenuOpen(false);
    clearMessages();

    if ((tab === 'visitRegister' || tab === 'visitHistory' || isCouponTab(tab) || tab === 'profile') && !isLoggedIn) {
      setActiveTab('login');
      setNotice('승인된 입주사 로그인 후 사용할 수 있습니다.');
      return;
    }

    setActiveTab(tab);

    if (tab === 'visitHistory') {
      void loadVisitHistory();
    }
  }

  useEffect(() => {
    if (!initialCode) return;
    setParkingLotCode(initialCode);
    void lookupParkingLot(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TENANT_APP_TOKEN_KEY);

    if (savedToken) {
      setTenantToken(savedToken);
      void refreshMe(savedToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 pb-28 text-slate-950">
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <section className="rounded-3xl bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-sky-600">KOSMOS Visit Register</p>
              <h1 className="mt-2 text-2xl font-bold">KOSMOS 방문 등록</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                승인된 입주사는 사업자등록번호와 PIN으로 로그인하여 방문 차량을 등록합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white"
              aria-label="메뉴 열기"
            >
              <span className="h-0.5 w-5 rounded-full bg-slate-900" />
              <span className="h-0.5 w-5 rounded-full bg-slate-900" />
              <span className="h-0.5 w-5 rounded-full bg-slate-900" />
            </button>
          </div>

          {menuOpen ? (
            <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
              {!isLoggedIn ? (
                <>
                  <MenuButton label="로그인" onClick={() => moveTab('login')} />
                  <MenuButton label="입주사 등록 신청" onClick={() => moveTab('apply')} />
                </>
              ) : (
                <>
                  <MenuButton label="주차 관리" onClick={() => moveTab('visitRegister')} />
                  <MenuButton label="할인권 구매·관리" onClick={() => moveTab('couponPurchase')} />
                  <MenuButton label="할인권 증정·관리" onClick={() => moveTab('couponAssign')} />
                  <MenuButton label="입주사 정보" onClick={() => moveTab('profile')} />
                  <MenuButton label="로그아웃" onClick={logout} />
                </>
              )}
            </div>
          ) : null}

          {isLoggedIn ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <p className="text-xs font-semibold text-emerald-700">로그인됨</p>
              <p className="mt-1 text-sm font-bold text-emerald-950">{tenantMe?.tenant.name}</p>
              <p className="mt-1 text-xs text-emerald-800">
                {tenantMe?.tenant.parkingLotName ?? '-'} · {tenantMe?.credential.businessNumber ?? '-'}
              </p>
            </div>
          ) : null}
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        {notice ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-700">
            {notice}
          </section>
        ) : null}

        {activeTab === 'login' ? (
          <section className="rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">입주사 로그인</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              승인된 입주사는 사업자등록번호 10자리와 PIN으로 로그인합니다.
            </p>

            {isLoggedIn ? (
              <div className="mt-4 grid gap-3">
                <TenantInfoCard me={tenantMe} meLoading={meLoading} onRefresh={() => refreshMe()} compact />
                <button
                  type="button"
                  onClick={() => moveTab('visitRegister')}
                  className="h-12 rounded-2xl bg-sky-600 text-base font-bold text-white"
                >
                  방문 등록으로 이동
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="h-12 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-800"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <Field label="사업자등록번호" required value={loginBusinessNumber} onChange={setLoginBusinessNumber} placeholder="예: 5078117904 (- 없이 10자리)" inputMode="numeric" maxLength={10} />
                <Field label="PIN" required value={loginPin} onChange={setLoginPin} placeholder="숫자 4~6자리" inputMode="numeric" maxLength={6} />

                <button
                  type="button"
                  onClick={login}
                  disabled={loginLoading}
                  className="h-12 rounded-2xl bg-slate-950 text-base font-bold text-white disabled:opacity-50"
                >
                  {loginLoading ? '로그인 중...' : '로그인'}
                </button>

                <div className="mt-2 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">아직 입주사 등록 전인가요?</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    QR 코드로 주차장을 선택하거나 주차장 코드를 입력해 입주사 등록을 신청할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => moveTab('apply')}
                    className="mt-3 h-11 w-full rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-800"
                  >
                    입주사 등록 신청
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'apply' ? (
          <>
            {result ? (
              <ApplicationDoneCard result={result} onLogin={() => moveTab('login')} />
            ) : (
              <>
                <ParkingLotSelectCard
                  parkingLotCode={parkingLotCode}
                  setParkingLotCode={setParkingLotCode}
                  parkingLot={parkingLot}
                  lookupLoading={lookupLoading}
                  lookupParkingLot={lookupParkingLot}
                />

                <section className="rounded-3xl bg-white p-6 shadow-xl">
                  <h2 className="text-lg font-bold">입주사 등록 신청</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    승인 후 사업자등록번호와 PIN으로 로그인합니다. 사업자등록번호는 하이픈 없이 입력해 주세요.
                  </p>

                  <div className="mt-4 grid gap-3">
                    <Field label="입주사명" required value={companyName} onChange={setCompanyName} placeholder="예: 테스트상점" />
                    <Field label="사업자등록번호" required value={businessNumber} onChange={setBusinessNumber} placeholder="예: 5078117904 (- 없이 10자리)" inputMode="numeric" maxLength={10} />
                    <Field label="대표자" value={representative} onChange={setRepresentative} placeholder="예: 홍길동" />
                    <Field label="입주사 연락처" value={contact} onChange={setContact} placeholder="예: 010-1111-2222" inputMode="tel" />
                    <Field label="정산 이메일" value={billingEmail} onChange={setBillingEmail} placeholder="예: billing@example.com" inputMode="email" />
                    <Field label="PIN" required value={pin} onChange={setPin} placeholder="숫자 4~6자리" inputMode="numeric" maxLength={6} />

                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">메모</span>
                      <textarea
                        value={memo}
                        onChange={(event) => setMemo(event.target.value)}
                        placeholder="관리자에게 전달할 내용을 입력하세요."
                        className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={submitApplication}
                    disabled={submitLoading || !parkingLot}
                    className="mt-5 h-12 w-full rounded-2xl bg-sky-600 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitLoading ? '신청 중...' : '입주사 등록 신청'}
                  </button>

                  <button
                    type="button"
                    onClick={() => moveTab('login')}
                    className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-800"
                  >
                    로그인 화면으로 돌아가기
                  </button>
                </section>
              </>
            )}
          </>
        ) : null}

        {isVisitTab(activeTab) ? (
          <section className="rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">주차 관리</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              방문 차량을 등록하고 처리 이력을 한 화면에서 확인합니다.
            </p>

            <SectionTabs
              items={[
                { label: '방문 등록', active: activeTab === 'visitRegister', onClick: () => moveTab('visitRegister') },
                { label: '방문 이력', active: activeTab === 'visitHistory', onClick: () => moveTab('visitHistory') },
              ]}
            />

            {isLoggedIn ? (
              <div className="mt-4 grid gap-4">
                <TenantSummaryCard me={tenantMe} />

                {activeTab === 'visitRegister' ? (
                  <VisitSearchCard
                    query={visitQuery}
                    setQuery={setVisitQuery}
                    note={visitNote}
                    setNote={setVisitNote}
                    items={visitSearchItems}
                    loading={visitSearchLoading}
                    confirmingId={visitConfirmLoadingId}
                    onSearch={searchVisits}
                    onConfirm={confirmVisit}
                  />
                ) : (
                  <VisitHistoryCard
                    date={visitHistoryDate}
                    setDate={setVisitHistoryDate}
                    query={visitHistoryQuery}
                    setQuery={setVisitHistoryQuery}
                    items={visitHistoryItems}
                    loading={visitHistoryLoading}
                    onRefresh={() => loadVisitHistory()}
                  />
                )}
              </div>
            ) : (
              <LoginRequiredCard onLogin={() => moveTab('login')} />
            )}
          </section>
        ) : null}

        {isCouponTab(activeTab) ? (
          <CouponPage
            activeTab={activeTab}
            accessToken={tenantToken}
            isLoggedIn={isLoggedIn}
            onLogin={() => moveTab('login')}
            onMoveTab={moveTab}
          />
        ) : null}

        {activeTab === 'profile' ? (
          <section className="rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">입주사 정보</h2>

            {isLoggedIn ? (
              <div className="mt-4 grid gap-4">
                <TenantInfoCard me={tenantMe} meLoading={meLoading} onRefresh={() => refreshMe()} />

                <section className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-950">PIN 변경</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    PIN은 숫자 4~6자리로 설정할 수 있습니다.
                  </p>

                  <div className="mt-3 grid gap-3">
                    <Field label="현재 PIN" value={currentPin} onChange={setCurrentPin} placeholder="현재 PIN" inputMode="numeric" maxLength={6} />
                    <Field label="새 PIN" value={newPin} onChange={setNewPin} placeholder="새 PIN" inputMode="numeric" maxLength={6} />

                    <button
                      type="button"
                      onClick={changePin}
                      disabled={pinLoading}
                      className="h-11 rounded-2xl bg-slate-950 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {pinLoading ? '변경 중...' : 'PIN 변경'}
                    </button>
                  </div>
                </section>

                <button
                  type="button"
                  onClick={logout}
                  className="h-12 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-800"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <LoginRequiredCard onLogin={() => moveTab('login')} />
            )}
          </section>
        ) : null}

        <CompanyFooter />

        {isLoggedIn ? (
          <footer className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-xl rounded-3xl bg-white/95 p-2 shadow-2xl ring-1 ring-slate-200 backdrop-blur">
            <div className="grid grid-cols-4 gap-1 text-xs font-semibold text-slate-600">
              <FooterButton active={isVisitTab(activeTab)} label="주차" onClick={() => moveTab('visitRegister')} />
              <FooterButton active={isCouponPurchaseTab(activeTab)} label="구매·관리" onClick={() => moveTab('couponPurchase')} />
              <FooterButton active={isCouponAssignTab(activeTab)} label="증정·관리" onClick={() => moveTab('couponAssign')} />
              <FooterButton active={activeTab === 'profile'} label="입주사" onClick={() => moveTab('profile')} />
            </div>
          </footer>
        ) : null}
      </div>
    </main>
  );
}


function CouponPage({
  activeTab,
  accessToken,
  isLoggedIn,
  onLogin,
  onMoveTab,
}: {
  activeTab: AppTab;
  accessToken: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onMoveTab: (tab: AppTab) => void;
}) {
  const view = couponViewForTab(activeTab);
  if (!view) return null;

  const content: Record<
    TenantCouponView,
    { title: string; description: string }
  > = {
    purchase: {
      title: '할인권 구매 신청',
      description: '할인권 상품과 수량을 선택해 선불 구매를 신청하고 처리 상태를 확인합니다.',
    },
    inventory: {
      title: '할인권 관리',
      description: '발행된 할인권의 사용 가능, 증정, 예약, 사용, 만료 현황을 확인합니다.',
    },
    assign: {
      title: '할인권 증정',
      description: '등록 회원을 전화번호 또는 차량번호로 조회해 할인권을 증정합니다.',
    },
    assignments: {
      title: '할인권 증정 관리',
      description: '회원별 할인권 증정 내역과 현재 상태 및 만료일을 확인합니다.',
    },
  };

  const purchaseGroup = view === 'purchase' || view === 'inventory';

  return (
    <section className="rounded-3xl bg-white p-6 shadow-xl">
      <h2 className="text-lg font-bold">
        {purchaseGroup ? '할인권 구매·관리' : '할인권 증정·관리'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {purchaseGroup
          ? '할인권 구매 신청과 보유 재고를 한 화면에서 관리합니다.'
          : '회원에게 할인권을 증정하고 증정 이력을 확인합니다.'}
      </p>

      <SectionTabs
        items={
          purchaseGroup
            ? [
                { label: '구매 신청', active: view === 'purchase', onClick: () => onMoveTab('couponPurchase') },
                { label: '보유 할인권', active: view === 'inventory', onClick: () => onMoveTab('couponInventory') },
              ]
            : [
                { label: '할인권 증정', active: view === 'assign', onClick: () => onMoveTab('couponAssign') },
                { label: '증정 이력', active: view === 'assignments', onClick: () => onMoveTab('couponAssignments') },
              ]
        }
      />

      <p className="mt-4 text-sm font-semibold text-slate-900">{content[view].title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{content[view].description}</p>

      {isLoggedIn ? (
        <div className="mt-4">
          <TenantCouponPanel accessToken={accessToken} view={view} />
        </div>
      ) : (
        <LoginRequiredCard onLogin={onLogin} />
      )}
    </section>
  );
}

function ParkingLotSelectCard({
  parkingLotCode,
  setParkingLotCode,
  parkingLot,
  lookupLoading,
  lookupParkingLot,
}: {
  parkingLotCode: string;
  setParkingLotCode: (value: string) => void;
  parkingLot: ParkingLot | null;
  lookupLoading: boolean;
  lookupParkingLot: () => void;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-xl">
      <h2 className="text-lg font-bold">주차장 선택</h2>

      <div className="mt-4 flex gap-2">
        <input
          value={parkingLotCode}
          onChange={(event) => setParkingLotCode(event.target.value)}
          placeholder="예: LOT-DEV-001"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-sky-400"
        />
        <button
          type="button"
          onClick={lookupParkingLot}
          disabled={lookupLoading}
          className="h-12 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {lookupLoading ? '조회 중' : '조회'}
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        QR 코드는 <span className="font-semibold">/tenant/app?code=주차장코드</span> 형식으로 생성하면 됩니다.
      </p>

      {parkingLot ? (
        <div className="mt-4 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
          <p className="text-sm font-semibold text-sky-700">선택된 주차장</p>
          <div className="mt-2 text-lg font-bold text-slate-950">{parkingLot.name}</div>
          <div className="mt-1 text-sm text-slate-600">
            코드 {parkingLot.code}
            {parkingLot.managementCompanyName ? ` · ${parkingLot.managementCompanyName}` : ''}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ApplicationDoneCard({ result, onLogin }: { result: ApplicationResult; onLogin: () => void }) {
  return (
    <section className="rounded-3xl bg-emerald-50 p-6 shadow-sm ring-1 ring-emerald-200">
      <p className="text-sm font-semibold text-emerald-700">신청 완료</p>
      <h2 className="mt-2 text-xl font-bold text-emerald-950">{result.companyName}</h2>
      <p className="mt-2 text-sm leading-6 text-emerald-800">
        입주사 등록 신청이 접수되었습니다. 관리자 또는 매니저 승인 후 사업자등록번호와 PIN으로 로그인할 수 있습니다.
      </p>
      <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
        신청번호: <span className="font-semibold">{result.id}</span>
        <br />
        상태: <span className="font-semibold">{result.status}</span>
      </div>
      <button
        type="button"
        onClick={onLogin}
        className="mt-4 h-12 w-full rounded-2xl bg-slate-950 text-base font-bold text-white"
      >
        로그인 화면으로 이동
      </button>
    </section>
  );
}

function VisitSearchCard({
  query,
  setQuery,
  note,
  setNote,
  items,
  loading,
  confirmingId,
  onSearch,
  onConfirm,
}: {
  query: string;
  setQuery: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  items: VisitSearchItem[];
  loading: boolean;
  confirmingId: string | null;
  onSearch: () => void;
  onConfirm: (item: VisitSearchItem) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <h3 className="text-sm font-bold text-slate-950">방문 차량 검색</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          차량번호 또는 연락처 일부를 입력해 현재 주차 중인 차량을 검색합니다.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSearch();
              }
            }}
            placeholder="예: 35두4792 또는 2983"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-sky-400"
          />
          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="h-12 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? '검색 중' : '검색'}
          </button>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">방문 메모</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="예: 매장 방문 고객"
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-sky-400"
          />
        </label>
      </section>

      <section className="grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-100">
            검색 결과가 없습니다.
          </div>
        ) : (
          items.map((item) => (
            <VisitSearchResultCard
              key={item.id}
              item={item}
              confirming={confirmingId === item.id}
              onConfirm={() => onConfirm(item)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function VisitSearchResultCard({
  item,
  confirming,
  onConfirm,
}: {
  item: VisitSearchItem;
  confirming: boolean;
  onConfirm: () => void;
}) {
  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">차량번호</p>
          <h3 className="mt-1 text-xl font-bold text-slate-950">{item.plateNumber ?? '-'}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {item.sectionCode ?? '-'}구역 · {item.spaceCode ?? '-'} · {item.contactPhone ?? '-'}
          </p>
        </div>

        <span
          className={
            item.alreadyConfirmed
              ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700'
              : 'rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700'
          }
        >
          {item.alreadyConfirmed ? '등록 완료' : '등록 가능'}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <InfoRow label="입차 시각" value={formatDateTime(item.entryTime)} />
        <InfoRow label="세션번호" value={item.sessionNo ?? '-'} />
        <InfoRow label="상태" value={item.status ?? '-'} />
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={confirming || item.alreadyConfirmed}
        className="mt-4 h-11 w-full rounded-2xl bg-sky-600 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {item.alreadyConfirmed ? '이미 방문 등록됨' : confirming ? '등록 중...' : '방문 등록'}
      </button>
    </article>
  );
}

function VisitHistoryCard({
  date,
  setDate,
  query,
  setQuery,
  items,
  loading,
  onRefresh,
}: {
  date: string;
  setDate: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  items: VisitHistoryItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const groupedItems = items.reduce<Record<string, VisitHistoryItem[]>>((acc, item) => {
    const key = item.confirmedAt ? item.confirmedAt.slice(0, 10) : date || '날짜 없음';
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  const groups = Object.entries(groupedItems);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <h3 className="text-sm font-bold text-slate-950">방문 이력 조회</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          기본값은 오늘 날짜입니다. 차량번호 또는 전화번호 일부로 이력을 검색할 수 있습니다.
        </p>

        <div className="mt-3 grid gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">조회 날짜</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-sky-400"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">차량번호/전화번호 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onRefresh();
                }
              }}
              placeholder="예: 35두4792 또는 2983"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-sky-400"
            />
          </label>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="h-11 rounded-2xl bg-slate-950 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? '조회 중...' : '이력 조회'}
          </button>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          선택한 날짜의 방문 등록 이력이 없습니다.
        </div>
      ) : (
        groups.map(([groupDate, groupItems]) => (
          <section key={groupDate} className="grid gap-3">
            <div className="sticky top-2 z-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow">
              {groupDate}
            </div>

            {groupItems.map((item) => (
              <article key={item.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">차량번호</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">{item.plateNumber ?? '-'}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.sectionCode ?? '-'}구역 · {item.spaceCode ?? '-'}
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {item.status ?? 'CONFIRMED'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm">
                  <InfoRow label="방문 등록" value={formatDateTime(item.confirmedAt)} />
                  <InfoRow label="입차 시각" value={formatDateTime(item.entryTime)} />
                  <InfoRow label="유예 종료" value={formatDateTime(item.graceUntil)} />
                  <InfoRow label="연락처" value={item.contactPhone ?? '-'} />
                  <InfoRow label="메모" value={item.note ?? '-'} />
                </div>
              </article>
            ))}
          </section>
        ))
      )}
    </div>
  );
}


function TenantSummaryCard({ me }: { me: MeResponse | null }) {
  return (
    <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
      <p className="text-xs font-semibold text-sky-700">현재 입주사</p>
      <h3 className="mt-1 text-base font-bold text-slate-950">{me?.tenant.name ?? '-'}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {me?.tenant.parkingLotName ?? '-'} · {me?.credential.businessNumber ?? '-'}
      </p>
    </div>
  );
}

function TenantInfoCard({
  me,
  meLoading,
  onRefresh,
  compact = false,
}: {
  me: MeResponse | null;
  meLoading: boolean;
  onRefresh: () => void;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">입주사 정보</p>
          <h3 className="mt-1 text-base font-bold text-slate-950">{me?.tenant.name ?? '-'}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {me?.tenant.parkingLotName ?? '-'} · {me?.credential.businessNumber ?? '-'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={meLoading}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-2 text-sm">
          <InfoRow label="대표자" value={me?.tenant.representative ?? '-'} />
          <InfoRow label="입주사 연락처" value={me?.tenant.contact ?? '-'} />
          <InfoRow label="정산 이메일" value={me?.tenant.billingEmail ?? '-'} />
          <InfoRow label="PIN 변경일" value={formatDateTime(me?.credential.pinUpdatedAt)} />
          <InfoRow label="최근 로그인" value={formatDateTime(me?.credential.lastLoginAt)} />
        </div>
      ) : null}
    </div>
  );
}

function LoginRequiredCard({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
      승인된 입주사 로그인 후 사용할 수 있습니다.
      <button
        type="button"
        onClick={onLogin}
        className="mt-3 h-11 w-full rounded-2xl bg-slate-950 text-sm font-bold text-white"
      >
        로그인하기
      </button>
    </div>
  );
}

function CompanyFooter() {
  return (
    <section className="rounded-3xl bg-slate-900 p-5 text-slate-300 ring-1 ring-white/10">
      <p className="text-sm font-bold text-white">코스모스 주식회사</p>
      <p className="mt-2 text-xs leading-5">
        대표: 윤도영 · 사업자등록번호: 507-81-17904
        <br />
        전화: 010-2983-1136 · 이메일: admin@kosmos.io.kr
        <br />
        홈페이지: www.kosmos.io.kr
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a
          href="/mobile/terms"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white/10 px-3 py-1.5 text-slate-100"
        >
          이용약관
        </a>
        <a
          href="/mobile/privacy"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white/10 px-3 py-1.5 text-slate-100"
        >
          개인정보처리방침
        </a>
        <button
          type="button"
          onClick={() => alert('고객센터: 010-2983-1136')}
          className="rounded-full bg-white/10 px-3 py-1.5 text-slate-100"
        >
          고객센터
        </button>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl bg-white px-3 py-2">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="break-all text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function SectionTabs({
  items,
}: {
  items: Array<{ label: string; active: boolean; onClick: () => void }>;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${
            item.active
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-white px-4 py-3 text-left font-semibold text-slate-900"
    >
      {label}
    </button>
  );
}

function FooterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-2 py-3 ${
        active ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  maxLength?: number;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    if (isComposing) return;
    setDraftValue(value);
  }, [isComposing, value]);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        value={draftValue}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(event) => {
          setIsComposing(false);
          const nextValue = event.currentTarget.value;
          setDraftValue(nextValue);
          onChange(nextValue);
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setDraftValue(nextValue);

          if (!isComposing) {
            onChange(nextValue);
          }
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete="off"
        className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-sky-400"
      />
    </label>
  );
}
