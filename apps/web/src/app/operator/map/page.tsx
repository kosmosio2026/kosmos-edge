import { MapPage } from '@/components/parking-operations/map-page';

export default function OperatorMapRoutePage() {
  return (
    <MapPage
      role="operator"
      title="담당 구역 지도"
      description="승인받은 주차 구역의 주차면을 지도에서 확인하고, 운영 방식에 맞게 입차/출차/등록 업무를 처리합니다."
    />
  );
}
