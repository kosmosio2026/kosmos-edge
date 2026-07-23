'use client';

import { normalizePin, validateVisitorPin } from '@parking/shared/validation';
import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { FORM_HINTS, FORM_PLACEHOLDERS } from '@/lib/forms/placeholders';

const API_BASE =
  getPublicApiBaseUrl();

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
    setMessage(FORM_HINTS.phoneDigitsOnly);
  }
}

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
    throw new Error(json?.message ?? text ?? '방문객 로그인에 실패했습니다.');
  }

  return json;
}

export default function MobileVisitorLoginPage() {
  const [phone, setPhone] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage(null);

    if (!phone.trim()) {
      setMessage('휴대폰 번호를 입력하세요.');
      return;
    }

    const pinValidation = validateVisitorPin(pinCode);

    if (!pinValidation.ok) {
      setMessage(pinValidation.message ?? '방문객 PIN은 숫자 4~6자리로 입력하세요.');
      return;
    }

    setSaving(true);

    try {
      const json = await apiFetch('/mobile/visitor/login', {
        method: 'POST',
        body: JSON.stringify({
          phone: formatKoreanMobilePhone(phone),
          pinCode: pinValidation.normalized,
        }),
      });

      localStorage.setItem('kosmos.visitorAccessToken', json.accessToken);
      localStorage.setItem('kosmos.visitorUser', JSON.stringify(json.user));

      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');

      window.location.href = next || '/mobile';
    } catch (error: any) {
      setMessage(error?.message ?? '방문객 로그인에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileAppShell
      title="방문객 로그인"
      subtitle="휴대폰 번호와 PIN으로 현재 주차를 확인하세요."
    >
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-300">
              KOSMOS PARKING
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight">
              방문객 로그인
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              주차 등록 시 사용한 휴대폰 번호와 방문객 PIN으로 조회할 수 있습니다.
            </p></div>

          <label className="mt-5 block">
            <span className="text-xs font-bold text-slate-400">휴대폰 번호</span>
            <input
              value={phone}
              onKeyDown={(event) => blockManualHyphen(event, setMessage)}
              onChange={(event) => setPhone(formatKoreanMobilePhone(event.target.value))}
              placeholder={FORM_PLACEHOLDERS.mobilePhone}
              inputMode="numeric"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
            <p className="mt-2 text-xs font-bold text-slate-400">
              {FORM_HINTS.phoneDigitsOnly}
            </p>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">방문객 PIN</span>
            <input
              value={pinCode}
              onChange={(event) => setPinCode(normalizePin(event.target.value))}
              placeholder={FORM_PLACEHOLDERS.visitorPin}
              inputMode="numeric"
              type="password"
                maxLength={6}
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
            {saving ? '로그인 중...' : '방문객 로그인'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-400"></p>
        
          <a
            href="/mobile/visitor/reset-pin"
            className="mt-4 block text-center text-sm font-black text-blue-600"
          >
            PIN을 잊으셨나요? 휴대폰 인증으로 재설정
          </a>
</section></div>
    </MobileAppShell>
  );
}
