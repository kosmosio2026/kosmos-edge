import { Suspense } from 'react';
import LoginPageClient from '@/app/login/login-page-client';

export default function ManagerLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient
        title="Manager Login"
        description="매니저 콘솔에 로그인합니다."
        roleHint="MANAGER"
        defaultRedirect="/manager/dashboard"
      />
    </Suspense>
  );
}