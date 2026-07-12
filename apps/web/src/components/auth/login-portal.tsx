'use client';

import Link from 'next/link';

const roles = [
  {
    role: 'ADMIN',
    title: 'Admin Console',
    description: '전체 시스템, 승인, 권한 관리',
    href: '/login?role=ADMIN',
  },
  {
    role: 'MANAGER',
    title: 'Manager Console',
    description: '주차장/구역/요금/운영자 승인 관리',
    href: '/login?role=MANAGER',
  },
  {
    role: 'OPERATOR',
    title: 'Operator Console',
    description: '현장 운영, 장치 장애, 주차 등록/정산',
    href: '/login?role=OPERATOR',
  },
] as const;

export function LoginPortal() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold">Smart Parking Console</h1>
          <p className="mt-2 text-sm text-slate-500">
            역할에 맞는 콘솔로 로그인하세요.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {roles.map((item) => (
            <Link
              key={item.role}
              href={item.href}
              className="rounded-3xl border bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xl font-semibold">{item.title}</div>
              <div className="mt-2 text-sm text-slate-500">{item.description}</div>
              <div className="mt-6 inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
                Continue
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}