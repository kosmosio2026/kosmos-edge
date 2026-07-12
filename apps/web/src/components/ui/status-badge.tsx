type Status =
  | 'EMPTY'
  | 'OCCUPIED'
  | 'REGISTERED'
  | 'VIOLATION'
  | 'PAID'
  | 'OVERDUE'
  | string;

export function StatusBadge({ status }: { status: Status }) {
  const style =
    status === 'EMPTY'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'OCCUPIED'
      ? 'bg-slate-100 text-slate-700 border-slate-200'
      : status === 'REGISTERED'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : status === 'VIOLATION'
      ? 'bg-red-50 text-red-700 border-red-200'
      : status === 'PAID'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'OVERDUE'
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}