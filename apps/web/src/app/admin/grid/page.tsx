import { OperatorGridPage } from '@/components/operator/operator-grid-page';

export default function AdminGridRoutePage() {
  return (
    <OperatorGridPage
      role="admin"
      title="Admin Grid"
      description="주차면 상태를 그리드 형식으로 확인합니다."
    />
  );
}
