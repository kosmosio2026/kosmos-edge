'use client';

import {
  formatKoreanPhoneNumber,
  normalizeEmail,
  validateEmail,
  validateKoreanPhoneNumber,
} from '@parking/shared/validation';
import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { FORM_PLACEHOLDERS } from '@/lib/forms/placeholders';

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
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function resolveLoginId() {
    const emailRaw = email.trim();
    const phoneRaw = phone.trim();

    if (!emailRaw && !phoneRaw) {
      return {
        ok: false,
        loginId: '',
        phone: undefined as string | undefined,
        message: '이메일 또는 전화번호 중 하나를 입력하세요.',
      };
    }

    if (emailRaw && phoneRaw) {
      return {
        ok: false,
        loginId: '',
        phone: undefined as string | undefined,
        message: '이메일 또는 전화번호 중 하나만 입력하세요.',
      };
    }

    if (emailRaw) {
      const emailValidation = validateEmail(emailRaw);

      return {
        ok: emailValidation.ok,
        loginId: emailValidation.normalized,
        phone: undefined as string | undefined,
        message: emailValidation.message,
      };
    }

    const phoneValidation = validateKoreanPhoneNumber(phoneRaw, {
      mobileOnly: true,
    });

    return {
      ok: phoneValidation.ok,
      loginId: phoneValidation.formatted,
      phone: phoneValidation.formatted,
      message: phoneValidation.message,
    };
  }

  async function submit() {
    setMessage(null);

    const loginValidation = resolveLoginId();

    if (!loginValidation.ok) {
      setMessage(loginValidation.message ?? '이메일 또는 전화번호를 확인하세요.');
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
          loginId: loginValidation.loginId,
          phone: loginValidation.phone,
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
              이메일 또는 전화번호 중 하나로 로그인하세요.
            </p>
          </div>

          <label className="mt-5 block">
            <span className="flex items-center gap-2 text-xs font-black text-slate-500">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-sm">
                📧
              </span>
              이메일
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(normalizeEmail(event.target.value))}
              placeholder={FORM_PLACEHOLDERS.email}
              type="email"
              inputMode="email"
              autoComplete="username"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-black text-slate-400">또는</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <label className="block">
            <span className="flex items-center gap-2 text-xs font-black text-slate-500">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-sm">
                📱
              </span>
              전화번호
            </span>
            <input
              value={phone}
              onChange={(event) => setPhone(formatKoreanPhoneNumber(event.target.value))}
              placeholder={FORM_PLACEHOLDERS.mobilePhone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <label className="mt-5 block">
            <span className="text-xs font-black text-slate-500">암호</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="회원가입 시 입력한 암호"
              type="password"
              autoComplete="current-password"
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

            <div className="mt-5 flex items-center justify-center gap-3 text-sm font-semibold">
              <a
                href="/mobile/member/signup"
                className="rounded-full bg-blue-50 px-4 py-2 text-blue-700 transition hover:bg-blue-100"
              >
                회원 가입
              </a>

              <a
                href="/mobile/member/password-reset"
                className="rounded-full bg-slate-100 px-4 py-2 text-slate-700 transition hover:bg-slate-200"
              >
                비밀번호 찾기
              </a>
            </div>
        </section>
      </div>
    </MobileAppShell>
  );
}
