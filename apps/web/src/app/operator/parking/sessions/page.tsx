import { Suspense } from 'react';
import ParkingSessionsPage from '@/features/parking/pages/sessions-page';

export default function OperatorParkingSessionsRoutePage() {
  return (
    <Suspense fallback={null}>
      <ParkingSessionsPage role="operator" />
    </Suspense>
  );
}
