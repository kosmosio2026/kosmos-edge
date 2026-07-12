import { MapFeatureGuard } from '@/components/operator/map-feature-guard';
import { OperatorMapPage } from '@/components/operator/operator-map-page';

export default function AdminMapRoutePage() {
  return (
    <MapFeatureGuard>
      <OperatorMapPage
        role="admin"
        title="Admin Map"
        description="주차장 지도와 주차면 상태를 실시간으로 확인합니다."
      />
    </MapFeatureGuard>
  );
}
