import { Suspense } from 'react';
import { TenantAppPage } from '@/features/tenant-app/pages/tenant-app-page';

export default function TenantAppRoute() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
          <div className="mx-auto max-w-xl rounded-3xl bg-white/10 p-6">
            Tenant 앱을 불러오는 중입니다...
          </div>
        </main>
      }
    >
      <TenantAppPage />
    </Suspense>
  );
}
