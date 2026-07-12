'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

const API_BASE =
  getPublicApiBaseUrl();

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
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
    throw new Error(json?.message ?? text ?? '로그인에 실패했습니다.');
  }

  return json;
}

export default function MobileLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage(null);

    if (!phone.trim()) {
      setMessage('이메일 ID 또는 휴대폰 번호를 입력하세요.');
      return;
    }

    if (!password) {
      setMessage('비밀번호를 입력하세요.');
      return;
    }

    setSaving(true);

    try {
      const json = await apiFetch('/mobile/member/login', {
        method: 'POST',
        body: JSON.stringify({
          loginId: phone.trim(),
          phone: phone.trim(),
          password,
        }),
      });

      localStorage.setItem('kosmos.mobileAccessToken', json.accessToken);
      localStorage.setItem('kosmos.mobileUser', JSON.stringify(json.user));

      setMessage('로그인되었습니다.');

      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');

      window.location.href = next || '/mobile';
    } catch (error: any) {
      setMessage(error?.message ?? '로그인에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileAppShell
      title="회원 로그인"
      subtitle="회원 차량으로 입차 감지된 주차면을 등록하세요."
    >
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-300">
              KOSMOS PARKING
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight">
              회원 로그인
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              회원가입 시 등록한 이메일 ID 또는 휴대폰 번호와 비밀번호로 로그인하세요.
            </p>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-bold text-slate-400">이메일 ID 또는 휴대폰 번호</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="이메일 또는 휴대폰 번호 · 예: member@kosmos.test 또는 01012345678"
              inputMode="tel"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">비밀번호</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="회원가입 시 입력한 비밀번호"
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          {message ? (
            <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-700">
              {message}
            </div>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {saving ? '로그인 중...' : '로그인'}
          </button>

          <a
            href="/mobile/member/signup"
            className="mt-4 block text-center text-sm font-bold text-blue-600"
          >
            아직 회원 계정이 없나요? 회원가입
          </a>
        </section>
      </div>
    </MobileAppShell>
  );
}
