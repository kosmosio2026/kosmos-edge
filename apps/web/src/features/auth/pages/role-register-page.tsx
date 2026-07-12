'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

type Role = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'MEMBER' | 'VISITOR';

type Props = {
  role: Role;
};

const configs = {
  ADMIN: {
    title: '관리자 가입',
    subtitle: '시스템 초기 설정을 위한 관리자 계정 생성',
    loginHref: '/admin/login',
    redirectHref: '/admin/login',
    button: '관리자 가입',
  },
  MANAGER: {
    title: '매니저 가입',
    subtitle: '주차장 운영 관리를 위한 매니저 계정 신청',
    loginHref: '/manager/login',
    redirectHref: '/manager/login',
    button: '매니저 가입 신청',
  },
  OPERATOR: {
    title: '운영자 가입',
    subtitle: '현장 주차 운영을 위한 운영자 계정 신청',
    loginHref: '/operator/login',
    redirectHref: '/operator/login',
    button: '운영자 가입 신청',
  },
  MEMBER: {
    title: '회원가입',
    subtitle: '일반 회원 주차 서비스를 시작하세요.',
    loginHref: '/login',
    redirectHref: '/login',
    button: '회원가입',
  },
  VISITOR: {
    title: '방문자 가입',
    subtitle: '방문 주차 이용을 위한 방문자 계정 생성',
    loginHref: '/visitor/login',
    redirectHref: '/visitor/login',
    button: '방문자 가입',
  },
};

export default function RoleRegisterPage({ role }: Props) {
  const config = configs[role];

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',

    setupCode: '',

    vehicleNo: '',
    emergencyContact: '',
    billingAutoPay: false,

    companyName: '',
    department: '',
    managerRegisterMode: 'CREATE_TENANT',
    tenantCode: '',

    employeeNo: '',
    shiftType: '',

    visitPurpose: '',
    hostName: '',
    note: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleDescription = useMemo(() => {
    if (role === 'ADMIN') return 'Admin';
    if (role === 'MANAGER') return 'Manager';
    if (role === 'OPERATOR') return 'Operator';
    if (role === 'VISITOR') return 'Visitor';
    return 'Member';
  }, [role]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(buildPayload(role, form)),
      });

      alert(`${config.title}이 완료되었습니다.`);
      window.location.href = config.redirectHref;
    } catch (error) {
      setError(error instanceof Error ? error.message : '가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
        <section className="hidden bg-slate-950 p-10 text-white md:block">
          <p className="text-sm text-slate-400">Smart Parking Platform</p>
          <h1 className="mt-6 text-4xl font-bold leading-tight">
            {config.title}
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            {config.subtitle}
          </p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Role: {roleDescription}
          </div>
        </section>

        <section className="p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            {config.title}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{config.subtitle}</p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Input label="이름" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="이메일" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Input label="전화번호" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="비밀번호" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <Input label="비밀번호 확인" type="password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} />

            {role === 'ADMIN' ? (
              <Input label="관리자 설정 코드" type="password" value={form.setupCode} onChange={(v) => setForm({ ...form, setupCode: v })} />
            ) : null}

            {role === 'MEMBER' ? (
              <>
                <Input label="차량번호" value={form.vehicleNo} onChange={(v) => setForm({ ...form, vehicleNo: v })} />
                <Input label="비상 연락처" value={form.emergencyContact} onChange={(v) => setForm({ ...form, emergencyContact: v })} />
                <Checkbox label="자동결제 사용" checked={form.billingAutoPay} onChange={(v) => setForm({ ...form, billingAutoPay: v })} />
              </>
            ) : null}

              {role === 'MANAGER' ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-800">가입 유형</div>

                    <div className="mt-3 grid gap-3">
                      <label className="flex cursor-pointer gap-3 rounded-xl border bg-white p-3 text-sm">
                        <input
                          type="radio"
                          name="managerRegisterMode"
                          checked={form.managerRegisterMode === 'CREATE_TENANT'}
                          onChange={() =>
                            setForm({
                              ...form,
                              managerRegisterMode: 'CREATE_TENANT',
                              tenantCode: '',
                            })
                          }
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">새 기업 등록</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            기업을 처음 등록하고 Tenant 대표로 승인 요청합니다.
                          </span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer gap-3 rounded-xl border bg-white p-3 text-sm">
                        <input
                          type="radio"
                          name="managerRegisterMode"
                          checked={form.managerRegisterMode === 'JOIN_TENANT'}
                          onChange={() =>
                            setForm({
                              ...form,
                              managerRegisterMode: 'JOIN_TENANT',
                              companyName: '',
                            })
                          }
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">
                            기존 기업에 Manager로 신청
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            이미 등록된 Tenant에 주차장 운영 Manager로 승인 요청합니다.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {form.managerRegisterMode === 'JOIN_TENANT' ? (
                    <Input
                      label="Tenant 코드"
                      value={form.tenantCode}
                      onChange={(v) => setForm({ ...form, tenantCode: v })}
                    />
                  ) : (
                    <Input
                      label="회사명"
                      value={form.companyName}
                      onChange={(v) => setForm({ ...form, companyName: v })}
                    />
                  )}

                  <Input label="부서" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
                </>
              ) : null}

            {role === 'OPERATOR' ? (
              <>
                <Input label="사번" value={form.employeeNo} onChange={(v) => setForm({ ...form, employeeNo: v })} />
                <Input label="회사명" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
                <Input label="근무 형태" value={form.shiftType} onChange={(v) => setForm({ ...form, shiftType: v })} />
              </>
            ) : null}

            {role === 'VISITOR' ? (
              <>
                <Input label="차량번호" value={form.vehicleNo} onChange={(v) => setForm({ ...form, vehicleNo: v })} />
                <Input label="방문 목적" value={form.visitPurpose} onChange={(v) => setForm({ ...form, visitPurpose: v })} />
                <Input label="방문 대상자" value={form.hostName} onChange={(v) => setForm({ ...form, hostName: v })} />
                <Textarea label="메모" value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
              </>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '처리 중...' : config.button}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            이미 계정이 있나요?{' '}
            <Link href={config.loginHref} className="font-semibold text-blue-600 hover:underline">
              로그인
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function buildPayload(role: Role, form: any) {
  const base = {
    role,
    name: form.name,
    email: form.email,
    phone: form.phone,
    password: form.password,
  };

  if (role === 'ADMIN') {
    return {
      ...base,
      setupCode: form.setupCode,
    };
  }

  if (role === 'MEMBER') {
    return {
      ...base,
      vehicleNo: form.vehicleNo,
      emergencyContact: form.emergencyContact,
      billingAutoPay: form.billingAutoPay,
    };
  }

    if (role === 'MANAGER') {
      const managerRegisterMode =
        form.managerRegisterMode === 'JOIN_TENANT' ? 'JOIN_TENANT' : 'CREATE_TENANT';

      return {
        ...base,
        companyName: form.companyName,
        department: form.department,
        managerRegisterMode,
        tenantRole: managerRegisterMode === 'JOIN_TENANT' ? 'MANAGER' : 'TENANT_OWNER',
        tenantCode: form.tenantCode,
      };
    }

  if (role === 'OPERATOR') {
    return {
      ...base,
      employeeNo: form.employeeNo,
      companyName: form.companyName,
      shiftType: form.shiftType,
    };
  }

  return {
    ...base,
    vehicleNo: form.vehicleNo,
    visitPurpose: form.visitPurpose,
    hostName: form.hostName,
    note: form.note,
  };
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}
