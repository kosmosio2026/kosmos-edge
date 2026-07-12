import { OperatorGridPage } from '@/components/operator/operator-grid-page';

export default function ManagerGridRoutePage() {
  return (
    <OperatorGridPage
      role="manager"
      title="Manager Grid"
      description="권한 주차장의 주차면 상태를 그리드 형식으로 확인합니다."
    />
  );
}
