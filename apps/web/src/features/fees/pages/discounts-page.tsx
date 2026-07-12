'use client';

import Link from 'next/link';
import type { ConsoleRole } from '@/lib/console-role';

type Props = {
  role?: ConsoleRole;
};

const discountPrograms = [
  { name: '회원 할인', rate: '20%', description: '회원 차량에 적용되는 기본 할인율' },
  { name: '전기차 할인', rate: '50%', description: '전기차 또는 친환경 차량 할인' },
  { name: '쿠폰 할인', rate: '15%', description: '쿠폰 등록 차량에 적용되는 할인' },
];

export default function DiscountsPage({ role = 'admin' }: Props) {
  const basePath = role === 'manager' ? '/manager' : '/admin';

  return (
    <main className="w-full max-w-none space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">할인 정책</h1>
          <p className="mt-1 text-sm text-slate-500">
            회원, 전기차, 쿠폰 등 주차 요금 할인 프로그램을 관리합니다.
          </p>
        </div>

        <Link
          href={`${basePath}/fees/policies`}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
        >
          요금 등록
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {discountPrograms.map((program) => (
          <DiscountCard
            key={program.name}
            name={program.name}
            rate={program.rate}
            description={program.description}
          />
        ))}
      </div>

      <section className="rounded-3xl border bg-white p-5 text-sm text-slate-600">
        할인 정책의 실제 적용 조건과 세부 요금은 요금 정책 화면에서 등록/수정합니다.
      </section>
    </main>
  );
}

function DiscountCard({
  name,
  rate,
  description,
}: {
  name: string;
  rate: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <div className="font-semibold text-slate-900">{name}</div>
      <div className="mt-3 text-3xl font-black text-slate-950">{rate}</div>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}
