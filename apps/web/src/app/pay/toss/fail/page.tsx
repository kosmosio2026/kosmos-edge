import { Suspense } from 'react';
import TossFailClientPage from '@/features/payments/pages/toss-fail-client-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TossFailClientPage />
    </Suspense>
  );
}
