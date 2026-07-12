import { RoleAreaShell } from '@/components/providers/role-area-shell';

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleAreaShell requiredRole="MEMBER" loginPath="/login">
      {children}
    </RoleAreaShell>
  );
}