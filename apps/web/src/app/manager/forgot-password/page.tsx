import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ManagerForgotPasswordPage() {
  return <ForgotPasswordForm role="MANAGER" loginHref="/manager/login" />;
}