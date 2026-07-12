import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function AdminForgotPasswordPage() {
  return <ForgotPasswordForm role="ADMIN" loginHref="/admin/login" />;
}