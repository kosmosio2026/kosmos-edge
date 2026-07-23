import { MapPage } from '@/components/parking-operations/map-page';

export default function ManagerMapRoutePage() {
  return (
    <MapPage
      role="manager"
      title="매니저 지도"
      description="담당 주차장의 주차면을 지도에서 확인하고, 운영 방식에 맞게 입차/출차/등록 업무를 처리합니다."
    />
  );
}
