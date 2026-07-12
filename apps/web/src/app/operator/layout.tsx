import { RoleAreaShell } from '@/components/providers/role-area-shell';
import { OperatorTabletNav } from '@/components/operator/operator-tablet-nav';
import { OperatorTabletFooter } from '@/components/operator/operator-tablet-footer';

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleAreaShell
      requiredRole="OPERATOR"
      loginPath="/operator/login"
      withAppShell={false}
    >
      <OperatorTabletNav />
      <div className="min-h-[calc(100vh-160px)]">
        {children}
      </div>
      <OperatorTabletFooter />
    </RoleAreaShell>
  );
}