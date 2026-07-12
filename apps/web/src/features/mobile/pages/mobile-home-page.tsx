'use client';

import { useEffect, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

type MobileSessionType = 'member' | 'visitor' | 'none';

function readJsonStorage(key: string) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function MobileHomePage() {
  const [sessionType, setSessionType] = useState<MobileSessionType>('none');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const memberToken = localStorage.getItem('kosmos.mobileAccessToken');
    const visitorToken = localStorage.getItem('kosmos.visitorAccessToken');

    if (memberToken) {
      setSessionType('member');
      setUser(readJsonStorage('kosmos.mobileUser'));
      return;
    }

    if (visitorToken) {
      setSessionType('visitor');
      setUser(readJsonStorage('kosmos.visitorUser'));
      return;
    }

    setSessionType('none');
    setUser(null);
  }, []);

  function logout() {
    localStorage.removeItem('kosmos.mobileAccessToken');
    localStorage.removeItem('kosmos.mobileUser');
    localStorage.removeItem('kosmos.visitorAccessToken');
    localStorage.removeItem('kosmos.visitorUser');

    setSessionType('none');
    setUser(null);
  }

  return (
    <MobileAppShell
      title="모바일 주차 서비스"
      subtitle="주차 등록, 현재 주차, 결제와 영수증을 확인하세요."
      sessionType={sessionType}
    >
      <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-300">
              KOSMOS PARKING
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight">
              모바일 주차 서비스
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              주차 등록, 현재 주차 상태, 결제와 영수증을 확인할 수 있습니다.
            </p>
          </div>

          {sessionType === 'member' ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl bg-blue-50 p-4">
                <p className="text-xs font-bold text-blue-500">회원 로그인</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {user?.name ?? user?.phone ?? '회원'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  등록 차량을 선택해 주차 등록을 진행할 수 있습니다.
                </p>
              </div>

              <div className="grid gap-3">
                <a
                  href="/mobile/parking/select?qrToken=dev-lot-qr"
                  className="rounded-3xl bg-slate-950 p-4 text-sm font-black text-white"
                >
                  지도에서 주차면 선택
                </a>
                <a
                  href="/mobile/member/vehicles"
                  className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-slate-900"
                >
                  내 등록 차량 보기
                </a>
                <a
                  href="/mobile/parking/current"
                  className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-slate-900"
                >
                  현재 주차 상태 보기
                </a>
                <a
                  href="/mobile/payments"
                  className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-slate-900"
                >
                  결제/영수증 확인
                </a>
              </div>

              <button
                type="button"
                onClick={logout}
                className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-base font-black text-white"
              >
                로그아웃
              </button>
            </div>
          ) : null}

          {sessionType === 'visitor' ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-600">방문객 로그인</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {user?.phone ?? '방문객'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  방문객 PIN으로 본인 주차 내역과 결제 정보를 조회합니다.
                </p>
              </div>

              <div className="grid gap-3">
                <a
                  href="/mobile/parking/select?qrToken=dev-lot-qr"
                  className="rounded-3xl bg-slate-950 p-4 text-sm font-black text-white"
                >
                  지도에서 주차면 선택
                </a>
                <a
                  href="/mobile/parking/current"
                  className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-slate-900"
                >
                  현재 주차 상태 보기
                </a>
                <a
                  href="/mobile/visitor/history"
                  className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-slate-900"
                >
                  방문 주차 이력 보기
                </a>
                <a
                  href="/mobile/payments"
                  className="rounded-3xl bg-slate-50 p-4 text-sm font-black text-slate-900"
                >
                  결제/영수증 확인
                </a>
              </div>

              <button
                type="button"
                onClick={logout}
                className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-base font-black text-white"
              >
                로그아웃
              </button>
            </div>
          ) : null}

          {sessionType === 'none' ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">
                  이용 방식을 선택하세요.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  회원은 등록 차량으로 주차하고, 방문객은 휴대폰 번호와 PIN으로 조회합니다.
                </p>
              </div>

              <a
                href="/mobile/parking/select?qrToken=dev-lot-qr"
                className="block rounded-2xl bg-slate-950 px-5 py-4 text-center text-base font-black text-white"
              >
                지도에서 주차면 먼저 선택
              </a>

              <a
                href="/mobile/member/login"
                className="block rounded-2xl bg-blue-600 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-blue-600/20"
              >
                회원 로그인
              </a>

              <a
                href="/mobile/member/signup"
                className="block rounded-2xl bg-white px-5 py-4 text-center text-base font-black text-blue-700 ring-1 ring-blue-100"
              >
                회원가입
              </a>

              <a
                href="/mobile/visitor/login"
                className="block rounded-2xl bg-slate-900 px-5 py-4 text-center text-base font-black text-white"
              >
                방문객 로그인
              </a>

              <p className="text-center text-xs text-slate-400">
                QR을 스캔하면 해당 주차장의 주차 등록 화면으로 이동합니다.
              </p>
            </div>
          ) : null}
      </section>
    </MobileAppShell>
  );
}
