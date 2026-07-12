export function Badge({
  label,
  color,
}: {
  label: string;
  color: 'green' | 'gray' | 'red' | 'blue';
}) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700',
    gray: 'bg-slate-100 text-slate-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${map[color]}`}>
      {label}
    </span>
  );
}