'use client';

import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

type Props = {
  title: string;
  subtitle: string;
  message: string;
};

export default function MobilePlaceholderPage({
  title,
  subtitle,
  message,
}: Props) {
  return (
    <MobileAppShell title={title} subtitle={subtitle}>
      <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
          KOSMOS PARKING
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">{title}</h1>
        <p className="mt-4 rounded-3xl bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-600">
          {message}
        </p>
        <a
          href="/mobile"
          className="mt-5 block rounded-2xl bg-blue-600 px-5 py-4 text-center text-base font-black text-white"
        >
          홈으로 이동
        </a>
      </section>
    </MobileAppShell>
  );
}
