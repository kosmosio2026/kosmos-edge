import { RoleAreaShell } from '@/components/providers/role-area-shell';

export default function VisitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleAreaShell requiredRole="VISITOR" loginPath="/login">
      {children}
    </RoleAreaShell>
  );
}