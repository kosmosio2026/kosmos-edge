import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function VisitorForgotPasswordPage() {
  return <ForgotPasswordForm role="VISITOR" loginHref="/visitor/login" />;
}