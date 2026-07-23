'use client';

import {
  validateKoreanPhoneNumber,
  validatePassword,
} from '@parking/shared/validation';
import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { FORM_HINTS, FORM_PLACEHOLDERS } from '@/lib/forms/placeholders';

const API_BASE = getPublicApiBaseUrl();

const SIZE_CLASS_OPTIONS = [
  { value: 'GENERAL', label: '일반 승용차' },
  { value: 'COMPACT', label: '경차' },
  { value: 'VAN', label: '승합차' },
  { value: 'TRUCK', label: '화물차' },
  { value: 'MOTORCYCLE', label: '이륜차' },
  { value: 'OTHER', label: '기타' },
] as const;

const POWERTRAIN_OPTIONS = [
  { value: 'ICE', label: '내연기관' },
  { value: 'HYBRID', label: '하이브리드' },
  { value: 'PHEV', label: '플러그인 하이브리드' },
  { value: 'EV', label: '전기차' },
  { value: 'HYDROGEN', label: '수소차' },
  { value: 'OTHER', label: '기타' },
] as const;

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
    const message = Array.isArray(json?.message)
      ? json.message.join(', ')
      : json?.message;
    throw new Error(message ?? text ?? '요청을 처리하지 못했습니다.');
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
  const [sizeClass, setSizeClass] = useState('GENERAL');
  const [powertrainType, setPowertrainType] = useState('ICE');
  const [disabledEligible, setDisabledEligible] = useState(false);
  const [pregnantEligible, setPregnantEligible] = useState(false);
  const [veteranEligible, setVeteranEligible] = useState(false);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function requestVerificationCode() {
    setMessage(null);

    const phoneValidation = validateKoreanPhoneNumber(phone, {
      mobileOnly: true,
    });

    if (!phoneValidation.ok) {
      setMessage(
        phoneValidation.message ?? '올바른 휴대전화 번호가 아닙니다.',
      );
      return;
    }

    setPhone(phoneValidation.formatted);
    setVerificationRequested(true);
    setPhoneVerified(false);
    setMessage(
      '인증번호를 발송했습니다. 테스트 단계에서는 123456을 입력하세요.',
    );
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

    const phoneValidation = validateKoreanPhoneNumber(phone, {
      mobileOnly: true,
    });

    if (!phoneValidation.ok) {
      setMessage(
        phoneValidation.message ?? '올바른 휴대전화 번호가 아닙니다.',
      );
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

    const passwordValidation = validatePassword(password);

    if (!passwordValidation.ok) {
      setMessage(
        passwordValidation.messages[0] ?? FORM_HINTS.passwordPolicy,
      );
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
          phone: phoneValidation.formatted,
          vehiclePlateNumber: vehiclePlateNumber.trim(),
          sizeClass,
          powertrainType,
          disabledEligible,
          pregnantEligible,
          veteranEligible,
          password,
          phoneVerificationCode: verificationCode.trim(),
          phoneVerified,
          agreeTerms,
        }),
      });

      setMessage(
        '회원가입이 완료되었습니다. 로그인 후 주차 등록을 진행하세요.',
      );
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
      subtitle="차량과 할인 자격을 등록하고 모바일 주차 서비스를 이용하세요."
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
              자격 할인은 회원과 현재 주차 차량이 일치하고, 해당 주차장에
              할인 프로그램이 등록된 경우에만 적용됩니다.
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
            <span className="text-xs font-bold text-slate-400">
              휴대폰 번호
            </span>
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
                  onChange={(event) =>
                    setVerificationCode(
                      event.target.value.replace(/[^0-9]/g, '').slice(0, 6),
                    )
                  }
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

          <div className="mt-5 rounded-3xl border border-slate-200 p-4">
            <h2 className="text-base font-black text-slate-900">차량 정보</h2>
            <p className="mt-1 text-xs text-slate-500">
              차량번호, 차량 분류, 동력원은 필수입니다.
            </p>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-slate-400">
                차량번호
              </span>
              <input
                value={vehiclePlateNumber}
                onChange={(event) =>
                  setVehiclePlateNumber(event.target.value.replace(/\s/g, ''))
                }
                placeholder={FORM_PLACEHOLDERS.plateNumber}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-slate-400">
                차량 분류
              </span>
              <select
                value={sizeClass}
                onChange={(event) => setSizeClass(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
              >
                {SIZE_CLASS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-slate-400">동력원</span>
              <select
                value={powertrainType}
                onChange={(event) => setPowertrainType(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
              >
                {POWERTRAIN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
            <h2 className="text-base font-black text-slate-900">
              개인 할인 자격
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              해당되는 항목만 선택하세요. 현재 버전은 국가망 검증 없이 회원이
              입력한 내용을 기준으로 판단합니다.
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <input
                  type="checkbox"
                  checked={disabledEligible}
                  onChange={(event) =>
                    setDisabledEligible(event.target.checked)
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold text-slate-700">
                  장애인 할인 대상
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <input
                  type="checkbox"
                  checked={pregnantEligible}
                  onChange={(event) =>
                    setPregnantEligible(event.target.checked)
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold text-slate-700">
                  임산부 할인 대상
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <input
                  type="checkbox"
                  checked={veteranEligible}
                  onChange={(event) =>
                    setVeteranEligible(event.target.checked)
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold text-slate-700">
                  국가유공자 할인 대상
                </span>
              </label>
            </div>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">비밀번호</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={FORM_PLACEHOLDERS.password}
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-bold outline-none focus:border-blue-500"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-400">
              비밀번호 확인
            </span>
            <input
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder={FORM_PLACEHOLDERS.passwordConfirm}
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
              이용약관 및 개인정보 처리방침에 동의합니다. 주차 등록, 요금
              계산과 자격 할인 적용을 위해 휴대폰 번호, 차량정보와 선택한
              할인 자격이 사용됩니다.
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
