'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

function toText(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-';
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export default function OperatorProfilePage() {
  const { session } = useAuth();
  const user = (session?.user ?? {}) as any;

  const [phone, setPhone] = useState(
    String(user.phone ?? user.mobilePhone ?? user.contactNumber ?? ''),
  );
  const [emergencyContact, setEmergencyContact] = useState(
    String(user.emergencyContact ?? user.operatorProfile?.emergencyContact ?? ''),
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const roles = useMemo(() => user.roles ?? user.role ?? '-', [user]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) return;

    setNotice('');
    setError('');

    if (!currentPassword.trim()) {
      setError('회원 정보를 수정하려면 현재 비밀번호를 입력해야 합니다.');
      return;
    }

    setSaving(true);

    try {
      await apiFetch('/auth/me/profile', {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: JSON.stringify({
          phone,
          emergencyContact,
          currentPassword,
        }),
      });

      setCurrentPassword('');
      setNotice('회원 정보가 수정되었습니다. 다시 로그인하면 최신 정보가 세션에 반영됩니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
          Operator Profile
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">회원 정보</h1>
        <p className="mt-2 text-sm font-bold text-slate-500">
          운영자 계정의 기본 정보와 연락처를 관리합니다.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[2rem] border bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-xs font-black text-slate-400">이름</div>
              <div className="mt-2 text-xl font-black text-slate-900">
                {toText(user.name)}
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-xs font-black text-slate-400">권한</div>
              <div className="mt-2 text-xl font-black text-slate-900">
                {toText(roles)}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-50 p-5">
            <div className="text-xs font-black text-slate-400">이메일</div>
            <div className="mt-2 break-all text-lg font-black text-slate-900">
              {toText(user.email)}
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[2rem] border bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-black text-slate-950">연락처 수정</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            휴대폰 번호와 비상 연락처 수정 시 현재 비밀번호 확인이 필요합니다.
          </p>

          <label className="mt-5 block">
            <span className="text-sm font-black text-slate-700">휴대폰 번호</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="010-0000-0000"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-700">비상 연락처</span>
            <input
              value={emergencyContact}
              onChange={(event) => setEmergencyContact(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="비상 연락처"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-700">현재 비밀번호</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="현재 비밀번호"
            />
          </label>

          {notice ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? '수정 중...' : '회원 정보 수정'}
          </button>
        </form>
      </section>
    </main>
  );
}
