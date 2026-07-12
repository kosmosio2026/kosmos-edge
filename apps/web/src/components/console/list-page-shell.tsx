import type { ReactNode } from 'react';

export function ListPageShell({
  header,
  filters,
  table,
}: {
  header: ReactNode;
  filters?: ReactNode;
  table: ReactNode;
}) {
  return (
    <div className="space-y-6">
      {header}
      {filters}
      {table}
    </div>
  );
}