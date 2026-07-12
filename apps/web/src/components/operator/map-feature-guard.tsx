'use client';

import { FEATURES } from '@/lib/features';

type Props = {
  children: React.ReactNode;
};

export function MapFeatureGuard({ children }: Props) {
  if (!FEATURES.kakaoMap) {
    return (
      <main className="space-y-6 p-6">
        <div className="rounded-3xl border bg-white p-8">
          <h1 className="text-2xl font-bold">Map is disabled</h1>
          <p className="mt-2 text-sm text-slate-500">
            Kakao Map integration is disabled in this environment. Use the Grid
            page to monitor parking spaces.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
