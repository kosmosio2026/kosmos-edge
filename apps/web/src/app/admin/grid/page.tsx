import { GridPage } from '@/components/parking-operations/grid-page';

export default function AdminGridRoutePage() {
  return (
    <GridPage
      role="admin"
      title="관리자 그리드"
      description="전체 주차장의 주차면을 그리드로 확인하고, 운영 방식에 맞게 입차/출차/등록 업무를 처리합니다."
    />
  );
}
