import { RoleAreaShell } from '@/components/providers/role-area-shell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleAreaShell requiredRole="ADMIN" loginPath="/admin/login">
      {children}
    </RoleAreaShell>
  );
}