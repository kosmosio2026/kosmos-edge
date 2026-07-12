'use client';

type MobileTab = 'summary' | 'map' | 'grid' | 'log';

export function OperatorMobileTabs({
  active,
  onChange,
}: {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  const tabs: Array<{ key: MobileTab; label: string }> = [
    { key: 'summary', label: 'Summary' },
    { key: 'map', label: 'Map' },
    { key: 'grid', label: 'Grid' },
    { key: 'log', label: 'Log' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto md:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-2xl px-4 py-2 text-sm ${
            active === tab.key
              ? 'bg-slate-900 text-white'
              : 'border bg-white text-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}