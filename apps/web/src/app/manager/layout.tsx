import { RoleAreaShell } from '@/components/providers/role-area-shell';

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleAreaShell requiredRole="MANAGER" loginPath="/manager/login">
      {children}
    </RoleAreaShell>
  );
}