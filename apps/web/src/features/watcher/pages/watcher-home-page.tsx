'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE, apiFetch, clearToken, getToken } from './watcher-utils';

export default function WatcherHomePage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('watcher@kosmos.test');
  const [password, setPassword] = useState('kosmos2026!!');
  const [name, setName] = useState('Watcher Test');
  const [phone, setPhone] = useState('01077778888');

  const [message, setMessage] = useState<string | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [lots, setLots] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);

  async function loadWatcherState() {
    if (!getToken()) return;

    try {
      const [lotJson, appJson] = await Promise.all([
        apiFetch('/watcher/lots'),
        apiFetch('/watcher/applications'),
      ]);
      setLots(lotJson);
      setApplications(appJson);
    } catch {
      setLots([]);
      setApplications([]);
    }
  }

  async function login() {
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? '로그인에 실패했습니다.');

      const token = json?.data?.accessToken ?? json?.accessToken ?? json?.token;
      if (!token) throw new Error('로그인 토큰을 찾을 수 없습니다.');

      localStorage.setItem('kosmos.watcherAccessToken', token);
      setTokenSaved(true);
      setMessage('로그인되었습니다.');
      await loadWatcherState();
    } catch (err: any) {
      setMessage(err.message ?? '로그인에 실패했습니다.');
    }
  }

  async function register() {
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          role: 'WATCHER',
          userType: 'WATCHER',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? '회원가입에 실패했습니다.');

      setMessage('Watcher 회원가입이 완료되었습니다. 로그인 후 Watcher 신청을 진행하세요.');
      setMode('login');
    } catch (err: any) {
      setMessage(err.message ?? '회원가입에 실패했습니다. 기존 계정이 있다면 로그인하세요.');
    }
  }

  function logout() {
    clearToken();
    setTokenSaved(false);
    setLots([]);
    setApplications([]);
    setMessage('로그아웃되었습니다.');
  }

  useEffect(() => {
    setTokenSaved(Boolean(getToken()));
    loadWatcherState();
  }, []);

  const pendingCount = applications.filter((item) => item.status === 'PENDING').length;
  const approvedCount = applications.filter((item) => item.status === 'APPROVED').length;
  const rejectedCount = applications.filter((item) => item.status === 'REJECTED').length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 w-full max-w-none">
      <section className="w-full max-w-none">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">KOSMOS WATCHER</p>
          <h1 className="mt-3 text-2xl font-bold">Watcher 단속 앱</h1>
          <p className="mt-2 text-sm text-slate-300">
            회원가입 후 주차장별 Watcher 신청을 하고, Manager 승인 후 단속 업무를 수행합니다.
          </p>
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">접속 상태</h2>
            {tokenSaved ? (
              <button onClick={logout} className="text-sm font-semibold text-red-600">
                로그아웃
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {tokenSaved ? '로그인 상태입니다.' : 'Watcher 로그인이 필요합니다.'}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-xl font-bold text-emerald-700">{approvedCount}</p>
              <p className="text-xs text-emerald-700">승인</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
              <p className="text-xs text-amber-700">대기</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-3">
              <p className="text-xl font-bold text-red-700">{rejectedCount}</p>
              <p className="text-xs text-red-700">거절</p>
            </div>
          </div>
        </div>

        {!tokenSaved && (
          <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                onClick={() => setMode('login')}
                className={`rounded-xl py-2 text-sm font-semibold ${
                  mode === 'login' ? 'bg-white shadow-sm' : 'text-slate-500'
                }`}
              >
                로그인
              </button>
              <button
                onClick={() => setMode('register')}
                className={`rounded-xl py-2 text-sm font-semibold ${
                  mode === 'register' ? 'bg-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Watcher 회원가입
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ID는 이메일 형식으로 입력하세요. 예: watcher@example.com"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />

              <input
                value={password}
                type="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="영문 대소문자, 숫자, 특수문자 사용 가능, 8자 이상 입력하세요."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />

              {mode === 'register' && (
                <>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="이름을 입력하세요."
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="휴대폰 번호를 입력하세요. 예: 01012345678"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </>
              )}

              {mode === 'login' ? (
                <button onClick={login} className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white">
                  Watcher 로그인
                </button>
              ) : (
                <button onClick={register} className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white">
                  Watcher 회원가입
                </button>
              )}
            </div>
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3">
          <Link href="/watcher/apply" className="rounded-3xl bg-white p-5 font-bold shadow-sm">
            Watcher 신청하기
            <p className="mt-1 text-sm font-normal text-slate-500">
              지역, 시군구, 주차장을 선택하여 신청합니다.
            </p>
          </Link>

          <Link href="/watcher/enforcement" className="rounded-3xl bg-white p-5 font-bold shadow-sm">
            단속 대상 보기
            <p className="mt-1 text-sm font-normal text-slate-500">
              승인된 주차장의 단속 대상을 확인합니다.
            </p>
          </Link>

          <Link href="/watcher/logs" className="rounded-3xl bg-white p-5 font-bold shadow-sm">
            직권 등록 이력
            <p className="mt-1 text-sm font-normal text-slate-500">
              내가 처리한 직권 등록 내역을 조회합니다.
            </p>
          </Link>
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">승인된 담당 주차장</h2>
          <div className="mt-3 space-y-2">
            {lots.length === 0 ? (
              <p className="text-sm text-slate-500">승인된 주차장이 없습니다.</p>
            ) : (
              lots.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                  <p className="font-semibold">{item.parkingLot?.name}</p>
                  <p className="text-sm text-slate-500">{item.parkingLot?.address}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
