import { redirect } from 'next/navigation';
import { RoleAreaShell } from '@/components/providers/role-area-shell';
import { isEdgeWeb } from '@/lib/app-profile';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isEdgeWeb()) {
    redirect('/manager/login');
  }

  return (
    <RoleAreaShell requiredRole="ADMIN" loginPath="/admin/login">
      {children}
    </RoleAreaShell>
  );
}
