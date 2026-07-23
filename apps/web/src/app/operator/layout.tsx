import { RoleAreaShell } from '@/components/providers/role-area-shell';
import { OperatorTabletChrome } from '@/components/operator/operator-tablet-chrome';

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
      <OperatorTabletChrome>
        {children}
      </OperatorTabletChrome>
    </RoleAreaShell>
  );
}
