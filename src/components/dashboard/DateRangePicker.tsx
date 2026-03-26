'use client';

export function DateRangePicker({
  from,
  to,
  onRangeChange,
}: {
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col">
        <label className="text-xs text-muted font-medium mb-1 pl-1">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onRangeChange(e.target.value, to)}
          className="h-9 px-3 py-2 bg-transparent border border-input rounded-md text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted font-medium mb-1 pl-1">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onRangeChange(from, e.target.value)}
          className="h-9 px-3 py-2 bg-transparent border border-input rounded-md text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}
