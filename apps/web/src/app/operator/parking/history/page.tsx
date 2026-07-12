import { Suspense } from 'react';
import ParkingSessionsPage from '@/features/parking/pages/sessions-page';

export default function OperatorParkingHistoryRoutePage() {
  return (
    <Suspense fallback={null}>
      <ParkingSessionsPage role="operator" historyOnly />
    </Suspense>
  );
}
