import { Suspense } from 'react';
import LoginPageClient from './login-page-client';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient
        title="Member / Visitor Login"
        description="회원 또는 방문자 계정으로 로그인하세요."
      />
    </Suspense>
  );
}