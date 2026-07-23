'use client';

import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = getPublicApiBaseUrl();

function getToken() {
  if (typeof window === 'undefined') return '';

  return (
    localStorage.getItem('kosmos.mobileAccessToken') ??
    localStorage.getItem('kosmos.visitorAccessToken') ??
    ''
  );
}

function getMemberToken() {
  if (typeof window === 'undefined') return '';

  return (
    localStorage.getItem('kosmos.memberAccessToken') ??
    localStorage.getItem('kosmos.mobileAccessToken') ??
    ''
  );
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

function getCurrentParkingSessionId() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kosmos.currentParkingSessionId') ?? '';
}

function withCurrentSessionId(path: string) {
  const sessionId = getCurrentParkingSessionId();
  return sessionId ? `${path}?sessionId=${encodeURIComponent(sessionId)}` : path;
}

function getCurrentParkingOwnerType() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kosmos.currentParkingSessionOwnerType') ?? '';
}

function isMemberParkingOwner() {
  if (typeof window === 'undefined') return false;

  const ownerType = getCurrentParkingOwnerType();
  const memberToken = localStorage.getItem('kosmos.memberAccessToken') ?? '';
  const visitorToken = localStorage.getItem('kosmos.visitorAccessToken') ?? '';

  return ownerType === 'member' || Boolean(memberToken && !visitorToken);
}

function getCurrentParkingAuthToken() {
  if (typeof window === 'undefined') return '';

  const ownerType = getCurrentParkingOwnerType();
  const visitorToken = localStorage.getItem('kosmos.visitorAccessToken') ?? '';
  const memberToken = localStorage.getItem('kosmos.memberAccessToken') ?? '';
  const sessionId = getCurrentParkingSessionId();

  if (ownerType === 'visitor') return visitorToken || getToken();
  if (ownerType === 'member') return memberToken || getToken();

  if (sessionId && visitorToken) return visitorToken;

  return getToken();
}

function couponBenefitLabel(product: any) {
  const value = Number(product?.benefitValue ?? 0);

  switch (product?.benefitType) {
    case 'PERCENT':
      return `${value}% 할인`;
    case 'FREE_MINUTES':
      return `${value}분 무료`;
    case 'FULL_WAIVER':
      return '주차요금 전액 할인';
    case 'FIXED_AMOUNT':
    default:
      return `${value.toLocaleString('ko-KR')}원 할인`;
  }
}

function remainingReservationText(value: string | null | undefined, now: number) {
  if (!value) return '-';

  const milliseconds = new Date(value).getTime() - now;

  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '예약 만료 처리 중';
  }

  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}분 ${String(seconds).padStart(2, '0')}초 남음`;
}

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export default function MobileCurrentParkingPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState<any>(null);
  const [fee, setFee] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponSavingId, setCouponSavingId] = useState('');
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [expiredRefreshCouponId, setExpiredRefreshCouponId] = useState('');

  const memberOwner = isMemberParkingOwner();

  async function loadFee(token = getCurrentParkingAuthToken()) {
    if (!token) return null;

    const feeRes = await fetch(
      `${API_BASE}${withCurrentSessionId('/mobile/parking/current/fee-preview')}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      },
    );
    const feeData = await readJson(feeRes);

    if (!feeRes.ok) {
      throw new Error(feeData?.message ?? '예상 요금을 불러오지 못했습니다.');
    }

    setFee(feeData?.fee ?? null);
    return feeData?.fee ?? null;
  }

  async function loadCoupons(parkingLotId?: string | null) {
    if (!memberOwner || !parkingLotId) {
      setCoupons([]);
      return [];
    }

    const memberToken = getMemberToken();

    if (!memberToken) {
      setCoupons([]);
      return [];
    }

    setCouponLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/mobile/me/coupons?parkingLotId=${encodeURIComponent(parkingLotId)}`,
        {
          headers: {
            authorization: `Bearer ${memberToken}`,
          },
          cache: 'no-store',
        },
      );
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data?.message ?? '보유 할인권을 불러오지 못했습니다.');
      }

      const nextCoupons = Array.isArray(data) ? data : [];
      setCoupons(nextCoupons);
      return nextCoupons;
    } finally {
      setCouponLoading(false);
    }
  }

  async function refreshFeeAndCoupons() {
    const token = getCurrentParkingAuthToken();

    if (!token || !current?.parkingLot?.id) return;

    await Promise.all([
      loadFee(token),
      loadCoupons(current.parkingLot.id),
    ]);
  }

  useEffect(() => {
    async function loadCurrent() {
      const token = getCurrentParkingAuthToken();

      if (!token) {
        window.location.href = '/mobile';
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}${withCurrentSessionId('/mobile/parking/current')}`,
          {
            headers: {
              authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          },
        );
        const data = await readJson(res);

        if (!res.ok) {
          throw new Error(data?.message ?? '현재 주차 정보를 불러오지 못했습니다.');
        }

        const nextCurrent = data?.current ?? null;
        setCurrent(nextCurrent);

        if (nextCurrent) {
          await Promise.all([
            loadFee(token),
            loadCoupons(nextCurrent?.parkingLot?.id),
          ]);
        }
      } catch (error: any) {
        setMessage(error?.message ?? '현재 주차 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    void loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedCoupon = useMemo(
    () =>
      coupons.find(
        (coupon) =>
          coupon?.status === 'RESERVED' &&
          coupon?.reservedSessionId === current?.id,
      ) ?? null,
    [coupons, current?.id],
  );

  useEffect(() => {
    const expiresAt = selectedCoupon?.reservationExpiresAt;

    if (
      !selectedCoupon?.id ||
      !expiresAt ||
      new Date(expiresAt).getTime() > now ||
      expiredRefreshCouponId === selectedCoupon.id
    ) {
      return;
    }

    setExpiredRefreshCouponId(selectedCoupon.id);
    void refreshFeeAndCoupons()
      .catch((error: any) => {
        setMessage(error?.message ?? '만료된 할인권 예약을 갱신하지 못했습니다.');
      })
      .finally(() => setExpiredRefreshCouponId(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, selectedCoupon?.id, selectedCoupon?.reservationExpiresAt]);

  async function reserveCoupon(couponId: string) {
    if (!current?.id || !couponId) return;

    const memberToken = getMemberToken();

    if (!memberToken) {
      setMessage('회원 로그인 후 할인권을 사용할 수 있습니다.');
      return;
    }

    setCouponSavingId(couponId);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/mobile/me/coupons/${couponId}/reserve`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${memberToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sessionId: current.id }),
      });
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data?.message ?? '할인권을 예약하지 못했습니다.');
      }

      setMessage('할인권이 결제를 위해 15분간 예약되었습니다.');
      await refreshFeeAndCoupons();
    } catch (error: any) {
      setMessage(error?.message ?? '할인권을 예약하지 못했습니다.');
    } finally {
      setCouponSavingId('');
    }
  }

  async function releaseCoupon(couponId: string) {
    if (!current?.id || !couponId) return;

    const memberToken = getMemberToken();

    if (!memberToken) return;

    setCouponSavingId(couponId);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/mobile/me/coupons/${couponId}/release`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${memberToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sessionId: current.id }),
      });
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data?.message ?? '할인권 예약을 해제하지 못했습니다.');
      }

      setMessage('할인권 예약이 해제되었습니다.');
      await refreshFeeAndCoupons();
    } catch (error: any) {
      setMessage(error?.message ?? '할인권 예약을 해제하지 못했습니다.');
    } finally {
      setCouponSavingId('');
    }
  }

  async function finalizeInvoiceAndPay() {
    if (!current?.id) return;

    const token = getCurrentParkingAuthToken();

    if (!token) {
      window.location.href = '/mobile';
      return;
    }

    setInvoiceSaving(true);
    setMessage('');

    try {
      const res = await fetch(
        `${API_BASE}${withCurrentSessionId('/mobile/parking/current/finalize-invoice')}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: '{}',
          cache: 'no-store',
        },
      );
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data?.message ?? '청구서를 확정하지 못했습니다.');
      }

      const invoiceId = data?.invoice?.id;

      if (!invoiceId) {
        throw new Error('생성된 청구서 ID를 확인하지 못했습니다.');
      }

      window.location.href = `/pay/invoice/${invoiceId}`;
    } catch (error: any) {
      setMessage(error?.message ?? '청구서를 확정하지 못했습니다.');
      setInvoiceSaving(false);
    }
  }

  const automaticDiscountAmount = Number(fee?.automaticDiscountAmount ?? 0);
  const automaticDiscounts = Array.isArray(fee?.automaticDiscounts)
    ? fee.automaticDiscounts
    : [];
  const tenantCouponDiscountAmount = Number(
    fee?.tenantCouponDiscountAmount ?? 0,
  );
  const reservationRemaining = remainingReservationText(
    selectedCoupon?.reservationExpiresAt,
    now,
  );

  return (
    <MobileAppShell
      title="주차 현황"
      subtitle="진행 중인 주차와 예상 요금을 확인하세요."
      sessionType="member"
    >
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          {loading ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
              현재 주차 정보를 불러오는 중입니다.
            </div>
          ) : null}

          {!loading && message ? (
            <div className="rounded-3xl bg-blue-50 p-5 text-sm font-bold text-blue-700">
              {message}
            </div>
          ) : null}

          {!loading && !message && !current ? (
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-lg font-black text-slate-900">
                현재 진행 중인 주차가 없습니다.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                QR을 스캔해 주차 등록을 진행하세요.
              </p>
            </div>
          ) : null}

          {!loading && current ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-blue-50 p-5">
                <p className="text-xs font-bold text-blue-500">주차장</p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {current.parkingLot?.name ?? '-'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {current.parkingLot?.address ?? current.parkingLot?.region ?? ''}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-400">주차면</p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {current.section?.name ? `${current.section.name} · ` : ''}
                    {current.parkingSpace?.code ?? '-'}
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-400">차량번호</p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {current.plateNumber ?? current.vehicle?.plateNumber ?? '-'}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">입차 시간</p>
                <p className="mt-1 text-base font-black text-slate-900">
                  {formatDateTime(current.entryTime)}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">등록 방식</p>
                <p className="mt-1 text-base font-black text-slate-900">
                  {current.registrationMethod === 'MEMBER_QR'
                    ? '회원 QR 등록'
                    : current.registrationMethod === 'VISITOR_QR'
                      ? '방문객 QR 등록'
                      : current.registrationMethod === 'OPERATOR_MANUAL'
                        ? '운영자 수동 등록'
                        : current.registrationMethod ?? '-'}
                </p>
              </div>

              {memberOwner ? (
                <div className="rounded-3xl border border-violet-100 bg-violet-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-violet-800">
                        보유 할인권
                      </p>
                      <p className="mt-1 text-xs font-bold text-violet-600">
                        현재 주차장에 사용할 할인권을 선택하세요.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">
                      {coupons.length}장
                    </span>
                  </div>

                  {couponLoading ? (
                    <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-500">
                      할인권을 불러오는 중입니다.
                    </p>
                  ) : null}

                  {!couponLoading && coupons.length === 0 ? (
                    <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-500">
                      현재 주차장에서 사용할 수 있는 할인권이 없습니다.
                    </p>
                  ) : null}

                  {!couponLoading && coupons.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {coupons.map((coupon) => {
                        const reservedForCurrent =
                          coupon.status === 'RESERVED' &&
                          coupon.reservedSessionId === current.id;
                        const reservedElsewhere =
                          coupon.status === 'RESERVED' && !reservedForCurrent;
                        const cannotStack =
                          automaticDiscountAmount > 0 &&
                          coupon.product?.stackableWithAutomaticDiscount === false;
                        const disabled =
                          Boolean(selectedCoupon && !reservedForCurrent) ||
                          reservedElsewhere ||
                          cannotStack ||
                          couponSavingId !== '';

                        return (
                          <div
                            key={coupon.id}
                            className={`rounded-2xl border p-4 ${
                              reservedForCurrent
                                ? 'border-violet-400 bg-white ring-2 ring-violet-200'
                                : 'border-white bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-950">
                                  {coupon.product?.name ?? '할인권'}
                                </p>
                                <p className="mt-1 text-xs font-bold text-slate-500">
                                  {coupon.tenant?.name ?? '-'} ·{' '}
                                  {couponBenefitLabel(coupon.product)}
                                </p>
                                <p className="mt-1 text-xs font-bold text-slate-400">
                                  {coupon.codeMasked ?? '-'} · 유효기간{' '}
                                  {formatDateTime(coupon.expiresAt)}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                                  reservedForCurrent
                                    ? 'bg-violet-100 text-violet-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {reservedForCurrent
                                  ? '선택됨'
                                  : reservedElsewhere
                                    ? '다른 주차 예약 중'
                                    : '사용 가능'}
                              </span>
                            </div>

                            {cannotStack ? (
                              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                                현재 자동 할인과 중복 사용할 수 없는 할인권입니다.
                              </p>
                            ) : null}

                            {reservedForCurrent ? (
                              <div className="mt-3">
                                <div className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">
                                  {reservationRemaining}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => releaseCoupon(coupon.id)}
                                  disabled={couponSavingId === coupon.id}
                                  className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
                                >
                                  {couponSavingId === coupon.id
                                    ? '예약 해제 중...'
                                    : '할인권 선택 취소'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => reserveCoupon(coupon.id)}
                                disabled={disabled}
                                className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                              >
                                {couponSavingId === coupon.id
                                  ? '할인권 예약 중...'
                                  : '이 할인권 사용'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {selectedCoupon ? (
                    <p className="mt-3 text-xs font-bold leading-5 text-violet-700">
                      할인권은 결제를 위해 15분간 예약됩니다. 시간 내 결제를
                      완료하지 않으면 자동으로 다시 사용할 수 있는 상태로
                      돌아갑니다.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {fee ? (
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold text-emerald-600">
                    예상 주차 요금
                  </p>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">이용 시간</span>
                      <span className="font-black text-slate-900">
                        {fee.totalMinutes ?? '-'}분
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">기본 주차요금</span>
                      <span className="font-black text-slate-900">
                        {formatCurrency(fee.baseParkingAmount ?? fee.amount)}
                      </span>
                    </div>

                    {Number(fee.registrationGraceDiscountAmount ?? 0) > 0 ? (
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-500">직접 등록 할인</span>
                        <span className="font-black text-blue-700">
                          -{formatCurrency(fee.registrationGraceDiscountAmount)}
                        </span>
                      </div>
                    ) : null}

                    {automaticDiscounts.length > 0
                      ? automaticDiscounts.map((discount: any) => (
                          <div
                            key={`${discount.programId}-${discount.appliedOrder}`}
                            className="flex justify-between gap-3"
                          >
                            <span className="font-bold text-slate-500">
                              {discount.programName ?? '자동 할인'}
                            </span>
                            <span className="shrink-0 font-black text-blue-700">
                              -{formatCurrency(discount.discountAmount ?? 0)}
                            </span>
                          </div>
                        ))
                      : automaticDiscountAmount > 0
                        ? (
                            <div className="flex justify-between">
                              <span className="font-bold text-slate-500">자동 할인</span>
                              <span className="font-black text-blue-700">
                                -{formatCurrency(automaticDiscountAmount)}
                              </span>
                            </div>
                          )
                        : null}

                    {tenantCouponDiscountAmount > 0 ? (
                      <div className="flex justify-between gap-3">
                        <span className="font-bold text-violet-700">
                          {fee.tenantCoupon?.tenantName
                            ? `${fee.tenantCoupon.tenantName} 할인권`
                            : 'Tenant 할인권'}
                        </span>
                        <span className="shrink-0 font-black text-violet-700">
                          -{formatCurrency(tenantCouponDiscountAmount)}
                        </span>
                      </div>
                    ) : null}

                    <div className="border-t border-emerald-100 pt-2">
                      <div className="flex justify-between">
                        <span className="font-black text-slate-700">최종 예상 금액</span>
                        <span className="text-lg font-black text-emerald-700">
                          {formatCurrency(fee.finalAmount ?? fee.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={finalizeInvoiceAndPay}
                disabled={invoiceSaving || couponSavingId !== ''}
                className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {invoiceSaving ? '청구서 확정 중...' : '할인 적용 후 결제하기'}
              </button>

              <a
                href="/mobile/payments"
                className="block rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-black text-slate-700"
              >
                결제/영수증 전체 내역
              </a>
            </div>
          ) : null}
        </section>
      </div>
    </MobileAppShell>
  );
}
