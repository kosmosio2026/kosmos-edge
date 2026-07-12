import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function OperatorForgotPasswordPage() {
  return <ForgotPasswordForm role="OPERATOR" loginHref="/operator/login" />;
}