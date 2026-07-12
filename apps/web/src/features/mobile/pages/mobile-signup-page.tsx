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
    throw new Error(json?.message ?? text ?? '요청을 처리하지 못했습니다.');
  }

  return json;
}

export default function MobileSignupPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function requestVerificationCode() {
    setMessage(null);

    if (!phone.trim()) {
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
    setMessage('휴대폰 인증이 완료되었습니다.');
  }

  async function submit() {
    setMessage(null);

    if (!name.trim()) {
      setMessage('이름을 입력하세요.');
      return;
    }

    if (!phone.trim()) {
      setMessage('휴대폰 번호를 입력하세요.');
      return;
    }

    if (!phoneVerified) {
      setMessage('휴대폰 인증을 완료하세요.');
      return;
    }

    if (!vehiclePlateNumber.trim()) {
      setMessage('차량번호를 입력하세요.');
      return;
    }

    if (password.length < 8) {
      setMessage('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (password !== passwordConfirm) {
      setMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    if (!agreeTerms) {
      setMessage('이용약관과 개인정보 처리방침에 동의해야 합니다.');
      return;
    }

    setSaving(true);

    try {
      await apiFetch('/mobile/member/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          vehiclePlateNumber: vehiclePlateNumber.trim(),
          password,
          phoneVerificationCode: verificationCode.trim(),
          phoneVerified,
          agreeTerms,
        }),
      });

      setMessage('회원가입이 완료되었습니다. 로그인 후 주차 등록을 진행하세요.');
      window.location.href = '/mobile/member/login';
    } catch (error: any) {
      setMessage(error?.message ?? '회원가입에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileAppShell
      title="회원가입"
      subtitle="차량번호를 등록하고 모바일 주차 서비스를 이용하세요."
    >
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-300">
              KOSMOS PARKING
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight">
              회원가입
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              휴대폰 인증 후 차량번호를 등록하면 회원 주차 등록을 사용할 수 있습니다.
            </p>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-bold text-slate-400">이름</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="실명 입력 · 예: 홍길동"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">휴대폰 번호</span>
            <input
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setPhoneVerified(false);
                setVerificationRequested(false);
                setVerificationCode('');
              }}
              placeholder="숫자만 입력 · 예: 01012345678"
              inputMode="tel"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestVerificationCode}
                className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white"
              >
                인증번호 요청
              </button>
              <div
                className={`flex items-center rounded-2xl px-4 py-3 text-xs font-black ${
                  phoneVerified
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-white text-slate-400'
                }`}
              >
                {phoneVerified ? '인증 완료' : '미인증'}
              </div>
            </div>

            {verificationRequested ? (
              <div className="mt-3 flex gap-2">
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="문자로 받은 인증번호 6자리 입력"
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

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">차량번호</span>
            <input
              value={vehiclePlateNumber}
              onChange={(event) => setVehiclePlateNumber(event.target.value)}
              placeholder="띄어쓰기 없이 입력 · 예: 12가3456 또는 123가4567"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">비밀번호</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상 · 영문, 숫자 조합 권장"
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">비밀번호 확인</span>
            <input
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="위 비밀번호와 동일하게 다시 입력"
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <label className="mt-5 flex items-start gap-3 rounded-3xl bg-slate-50 p-4">
            <input
              checked={agreeTerms}
              onChange={(event) => setAgreeTerms(event.target.checked)}
              type="checkbox"
              className="mt-1 h-4 w-4"
            />
            <span className="text-sm font-semibold text-slate-600">
              이용약관 및 개인정보 처리방침에 동의합니다. 주차 등록과 요금 정산을 위해 휴대폰 번호와 차량번호가 사용됩니다.
            </span>
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
            {saving ? '가입 중...' : '회원가입 완료'}
          </button>

          <a
            href="/mobile/member/login"
            className="mt-4 block text-center text-sm font-bold text-blue-600"
          >
            이미 회원 계정이 있나요? 로그인
          </a>
        </section>
      </div>
    </MobileAppShell>
  );
}
