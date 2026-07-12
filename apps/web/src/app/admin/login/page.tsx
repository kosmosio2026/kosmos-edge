import { Suspense } from 'react';
import LoginPageClient from '@/app/login/login-page-client';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient
        title="Admin Login"
        description="관리자 콘솔에 로그인합니다."
        roleHint="ADMIN"
        defaultRedirect="/admin/dashboard"
      />
    </Suspense>
  );
}