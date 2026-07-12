import { Suspense } from 'react';
import LoginPageClient from '@/app/login/login-page-client';

export default function OperatorLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient
        title="Operator Login"
        description="운영자 콘솔에 로그인합니다."
        roleHint="OPERATOR"
        defaultRedirect="/operator/dashboard"
      />
    </Suspense>
  );
}