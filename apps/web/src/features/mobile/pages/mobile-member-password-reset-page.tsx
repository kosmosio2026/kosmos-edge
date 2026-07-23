'use client';

import { useMemo, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { getPublicApiBaseUrl } from '@/lib/public-config';

const API_BASE = getPublicApiBaseUrl();

type ResetStep = 'request' | 'confirm' | 'done';

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.message ?? data?.details?.message ?? '요청을 처리하지 못했습니다.',
    );
  }
  return data;
}

export function MobileMemberPasswordResetPage() {
  const [step, setStep] = useState<ResetStep>('request');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const phoneDigits = useMemo(() => normalizePhone(phone), [phone]);

  async function requestCode() {
    if (!/^01\d{8,9}$/.test(phoneDigits)) {
      setError('휴대전화번호를 정확히 입력하세요.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `${API_BASE}/mobile/member/password-reset/request`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phone: phoneDigits }),
        },
      );
      const data = await readResponse(response);
      setDevCode(data.verificationCodeForDev ?? null);
      setMessage(data.message ?? '인증번호가 발송되었습니다.');
      setStep('confirm');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '인증번호 요청에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!/^\d{6}$/.test(verificationCode)) {
      setError('6자리 인증번호를 입력하세요.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('새 비밀번호는 영문과 숫자를 포함한 8자 이상으로 입력하세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `${API_BASE}/mobile/member/password-reset/confirm`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            phone: phoneDigits,
            verificationCode,
            newPassword,
            confirmPassword,
          }),
        },
      );
      const data = await readResponse(response);
      [
        'kosmos.mobileAccessToken',
        'kosmos.memberAccessToken',
        'kosmos.mobileUser',
      ].forEach((key) => localStorage.removeItem(key));
      setMessage(data.message ?? '비밀번호가 재설정되었습니다.');
      setStep('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '비밀번호 재설정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileAppShell
      title="회원 비밀번호 재설정"
      subtitle="휴대전화 인증 후 새 비밀번호를 설정합니다."
      sessionType="none"
    >
      <section className="rounded-[1.75rem] bg-white p-5 shadow-xl">
        {step === 'done' ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-950">재설정 완료</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              {message}
            </p>
            <a
              href="/mobile/member/login"
              className="mt-5 block rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white"
            >
              새 비밀번호로 로그인
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                Member password reset
              </p>
              <h2 className="mt-2 text-lg font-black text-slate-950">
                {step === 'request' ? '회원 휴대전화 확인' : '새 비밀번호 설정'}
              </h2>
            </div>

            <label className="block">
              <span className="text-xs font-black text-slate-500">휴대전화번호</span>
              <input
                value={formatPhone(phone)}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="numeric"
                autoComplete="tel"
                disabled={step === 'confirm'}
                placeholder="010-0000-0000"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500 disabled:bg-slate-100"
              />
            </label>

            {step === 'confirm' ? (
              <>
                <label className="block">
                  <span className="text-xs font-black text-slate-500">인증번호</span>
                  <input
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6자리 인증번호"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
                  />
                </label>

                {devCode ? (
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
                    개발용 인증번호: {devCode}
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-xs font-black text-slate-500">새 비밀번호</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="영문과 숫자를 포함한 8자 이상"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-500">새 비밀번호 확인</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="새 비밀번호를 다시 입력"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
                  />
                </label>
              </>
            ) : null}

            {message ? (
              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-blue-800">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">
                {error}
              </div>
            ) : null}

            {step === 'request' ? (
              <button
                type="button"
                onClick={requestCode}
                disabled={saving}
                className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white disabled:opacity-50"
              >
                {saving ? '인증번호 요청 중...' : '인증번호 받기'}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setVerificationCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setDevCode(null);
                    setError(null);
                  }}
                  disabled={saving}
                  className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-black text-slate-700 disabled:opacity-50"
                >
                  번호 다시 입력
                </button>
                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={saving}
                  className="rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? '재설정 중...' : '비밀번호 재설정'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </MobileAppShell>
  );
}
