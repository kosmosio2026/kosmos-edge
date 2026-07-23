import { GridPage } from '@/components/parking-operations/grid-page';

export default function OperatorGridRoutePage() {
  return (
    <GridPage
      role="operator"
      title="담당 주차 구역 현황"
      description="승인받은 주차 구역의 주차면을 그리드로 확인하고, 운영 방식에 맞게 입차/출차/등록 업무를 처리합니다."
    />
  );
}
