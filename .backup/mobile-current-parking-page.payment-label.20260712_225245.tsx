'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

const API_BASE =
  getPublicApiBaseUrl();

function getToken() {
  if (typeof window === 'undefined') return '';

  return (
    localStorage.getItem('kosmos.mobileAccessToken') ??
    localStorage.getItem('kosmos.visitorAccessToken') ??
    ''
  );
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function getCurrentParkingSessionId() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kosmos.currentParkingSessionId') ?? '';
}

function withCurrentSessionId(path: string) {
  const sessionId = getCurrentParkingSessionId();
  return sessionId ? `${path}?sessionId=${encodeURIComponent(sessionId)}` : path;
}

export default function MobileCurrentParkingPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState<any>(null);
  const [fee, setFee] = useState<any>(null);

  useEffect(() => {
    async function loadCurrent() {
      const token = getToken();

      if (!token) {
        window.location.href = '/mobile';
        return;
      }

      try {
        const res = await fetch(`${API_BASE}${withCurrentSessionId('/mobile/parking/current')}`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message ?? '현재 주차 정보를 불러오지 못했습니다.');
        }

        setCurrent(data?.current ?? null);

        const feeRes = await fetch(`${API_BASE}${withCurrentSessionId('/mobile/parking/current/fee-preview')}`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const feeData = await feeRes.json();

        if (feeRes.ok) {
          setFee(feeData?.fee ?? null);
        }
      } catch (error: any) {
        setMessage(error?.message ?? '현재 주차 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadCurrent();
  }, []);

  return (
    <MobileAppShell
      title="현재 주차"
      subtitle="현재 주차 상태와 예상 요금을 확인하세요."
      sessionType="member"
    >
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                CURRENT PARKING
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">
                현재 주차 상태
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                현재 진행 중인 주차 정보를 확인합니다.
              </p>
            </div>

            <a
              href="/mobile"
              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
            >
              홈
            </a>
          </div>

          {loading ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
              현재 주차 정보를 불러오는 중입니다.
            </div>
          ) : null}

          {!loading && message ? (
            <div className="mt-5 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-600">
              {message}
            </div>
          ) : null}

          {!loading && !message && !current ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5">
              <p className="text-lg font-black text-slate-900">
                현재 진행 중인 주차가 없습니다.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                QR을 스캔해 주차 등록을 진행하세요.
              </p>
            </div>
          ) : null}

          {!loading && current ? (
            <div className="mt-5 space-y-4">
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
                  {current.entryTime
                    ? new Date(current.entryTime).toLocaleString('ko-KR')
                    : '-'}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">등록 방식</p>
                <p className="mt-1 text-base font-black text-slate-900">
                  {current.registrationMethod === 'MEMBER_QR'
                    ? '회원 QR 등록'
                    : current.registrationMethod === 'VISITOR_QR'
                      ? '방문객 QR 등록'
                      : current.registrationMethod ?? '-'}
                </p>
              </div>

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

                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">직접 등록 할인</span>
                      <span className="font-black text-blue-700">
                        -{formatCurrency(fee.registrationGraceDiscountAmount ?? 0)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">직권 등록 추가/할인</span>
                      <span className="font-black text-slate-900">
                        {formatCurrency(fee.authorityRegistrationSurchargeAmount ?? 0)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">Watcher 보상 기준</span>
                      <span className="font-black text-slate-900">
                        {formatCurrency(fee.watcherRewardBasisAmount ?? 0)}
                      </span>
                    </div>

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

              <a
                href="/mobile/payments"
                className="block rounded-2xl bg-blue-600 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-blue-600/20"
              >
                결제/영수증 확인
              </a>
            </div>
          ) : null}
        </section>
      </div>
    </MobileAppShell>
  );
}
