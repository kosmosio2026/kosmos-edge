import { MapPage } from '@/components/parking-operations/map-page';

export default function AdminMapRoutePage() {
  return (
    <MapPage
      role="admin"
      title="관리자 지도"
      description="전체 주차장의 주차면을 지도에서 확인하고, 운영 방식에 맞게 입차/출차/등록 업무를 처리합니다."
    />
  );
}
