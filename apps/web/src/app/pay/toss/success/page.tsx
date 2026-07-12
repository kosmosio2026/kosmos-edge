import { Suspense } from 'react';
import TossSuccessClientPage from '@/features/payments/pages/toss-success-client-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TossSuccessClientPage />
    </Suspense>
  );
}
