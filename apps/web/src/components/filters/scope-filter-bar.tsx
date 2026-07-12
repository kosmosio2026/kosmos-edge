'use client';

interface ScopeFilterBarProps {
  parkingLots?: Array<{ id: string; name: string }>;
  sections?: Array<{ id: string; name: string }>;
  selectedLotId?: string;
  selectedSectionId?: string;
  onChangeLot?: (value: string) => void;
  onChangeSection?: (value: string) => void;
}

export function ScopeFilterBar({
  parkingLots = [],
  sections = [],
  selectedLotId = '',
  selectedSectionId = '',
  onChangeLot,
  onChangeSection,
}: ScopeFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row">
      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium">Parking Lot</label>
        <select
          className="h-11 w-full rounded-2xl border bg-card px-4 text-sm"
          value={selectedLotId}
          onChange={(e) => onChangeLot?.(e.target.value)}
        >
          <option value="">All lots</option>
          {parkingLots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium">Section</label>
        <select
          className="h-11 w-full rounded-2xl border bg-card px-4 text-sm"
          value={selectedSectionId}
          onChange={(e) => onChangeSection?.(e.target.value)}
        >
          <option value="">All sections</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}