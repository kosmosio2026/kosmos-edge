'use client';

import { normalizePin, validateVisitorPin } from '@parking/shared/validation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { apiFetch } from '@/lib/api-client';
import { FORM_HINTS, FORM_PLACEHOLDERS } from '@/lib/forms/placeholders';

function formatPhone(value: string) {
  return value.replace(/[^0-9]/g, '').slice(0, 11);
}

export default function MobileVisitorResetPinPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [requested, setRequested] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!resetDone) return;

    const timer = window.setTimeout(() => {
      window.location.href = '/mobile/visitor/login';
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [resetDone]);

  async function requestCode() {
    const normalizedPhone = formatPhone(phone);

    if (!normalizedPhone) {
      setMessage('휴대폰 번호를 입력하세요.');
      return;
    }

    setSaving(true);
    setMessage('인증번호를 요청하는 중입니다.');

    try {
      const result = await apiFetch('/mobile/visitor/request-phone-verification', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      setRequested(true);
      setDevCode(result?.verificationCodeForDev ?? '');
      setMessage('인증번호를 발송했습니다. 개발 환경에서는 인증번호 123456을 사용할 수 있습니다.');
    } catch (error: any) {
      setMessage(error?.message ?? '인증번호 요청에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function resetPin() {
    setMessage('PIN 재설정을 요청하는 중입니다.');

    const normalizedPhone = formatPhone(phone);

    if (!normalizedPhone) {
      setMessage('휴대폰 번호를 입력하세요.');
      return;
    }

    if (!code.trim()) {
      setMessage('인증번호를 입력하세요.');
      return;
    }

    const pinValidation = validateVisitorPin(pin);
    const normalizedPinConfirm = normalizePin(pinConfirm);

    if (!pinValidation.ok) {
      setMessage(pinValidation.message ?? '새 PIN은 숫자 4~6자리로 입력하세요.');
      return;
    }

    if (pinValidation.normalized !== normalizedPinConfirm) {
      setMessage('새 PIN과 확인 PIN이 일치하지 않습니다.');
      return;
    }

    setSaving(true);
    setMessage('휴대폰 인증번호를 확인하고 PIN을 재설정하는 중입니다.');

    try {
      await apiFetch('/mobile/visitor/reset-pin', {
        method: 'POST',
        body: JSON.stringify({
          phone: normalizedPhone,
          code: code.trim(),
          pin: pinValidation.normalized,
        }),
      });

      setMessage('방문객 PIN이 재설정되었습니다. 잠시 후 로그인 화면으로 이동합니다.');
      setResetDone(true);
      setPin('');
      setPinConfirm('');
    } catch (error: any) {
      setMessage(error?.message ?? 'PIN 재설정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileAppShell title="방문객 PIN 재설정" subtitle="휴대폰 인증 후 새 PIN을 설정하세요.">
      <main className="space-y-5 px-4 pb-24 pt-4">
        <section className="rounded-[2rem] bg-white p-5 shadow-xl">
          <label className="block text-xs font-black text-slate-500">휴대폰 번호</label>
          <input
            value={phone}
            onChange={(event) => setPhone(formatPhone(event.target.value))}
            inputMode="numeric"
            placeholder={FORM_PLACEHOLDERS.mobilePhone}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-base font-bold text-slate-950"
          />

          <button
            type="button"
            onClick={() => void requestCode()}
            disabled={saving}
            className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? '처리 중...' : '인증번호 요청'}
          </button>

          {requested ? (
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500">인증번호</label>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="123456"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-base font-bold text-slate-950"
                />
                {devCode ? (
                  <p className="mt-2 text-xs font-bold text-blue-600">개발용 인증번호: {devCode}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500">새 PIN</label>
                <input
                  value={pin}
                  onChange={(event) => setPin(normalizePin(event.target.value))}
                  inputMode="numeric"
                  type="password"
                  maxLength={6}
                    placeholder={FORM_PLACEHOLDERS.visitorPin}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-base font-bold text-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500">새 PIN 확인</label>
                <input
                  value={pinConfirm}
                  onChange={(event) => setPinConfirm(normalizePin(event.target.value))}
                  inputMode="numeric"
                  type="password"
                  maxLength={6}
                    placeholder={FORM_PLACEHOLDERS.visitorPinConfirm}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-base font-bold text-slate-950"
                />
              </div>

              <button
                type="button"
                onClick={() => void resetPin()}
                disabled={saving}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {saving ? '재설정 중...' : 'PIN 재설정'}
              </button>
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-700">
              {message}
            </div>
          ) : null}

          {resetDone ? (
            <Link
              href="/mobile/visitor/login"
              className="mt-4 block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white"
            >
              새 PIN으로 로그인하기
            </Link>
          ) : (
            <Link
              href="/mobile/visitor/login"
              className="mt-4 block text-center text-sm font-black text-blue-600"
            >
              방문객 PIN 로그인으로 돌아가기
            </Link>
          )}
        </section>
      </main>
    </MobileAppShell>
  );
}
