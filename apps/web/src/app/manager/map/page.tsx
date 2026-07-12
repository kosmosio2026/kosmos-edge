import { MapFeatureGuard } from '@/components/operator/map-feature-guard';
import { OperatorMapPage } from '@/components/operator/operator-map-page';

export default function ManagerMapRoutePage() {
  return (
    <MapFeatureGuard>
      <OperatorMapPage
        role="manager"
        title="지도"
        description="권한 주차장의 지도와 주차면 상태를 실시간으로 확인합니다."
      />
    </MapFeatureGuard>
  );
}
