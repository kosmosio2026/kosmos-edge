import { MapFeatureGuard } from '@/components/operator/map-feature-guard';
import { OperatorMapPage } from '@/components/operator/operator-map-page';

export default function OperatorMapRoutePage() {
  return (
    <MapFeatureGuard>
      <OperatorMapPage
        title="담당 구역 맵"
        description="승인받은 주차 구역의 주차면만 표시됩니다."
      />
    </MapFeatureGuard>
  );
}
