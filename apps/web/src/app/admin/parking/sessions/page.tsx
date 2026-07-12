import { Suspense } from 'react';
import ParkingSessionsPage from '@/features/parking/pages/sessions-page';

export default function AdminParkingSessionsRoutePage() {
  return (
    <Suspense fallback={null}>
      <ParkingSessionsPage role="admin" />
    </Suspense>
  );
}
