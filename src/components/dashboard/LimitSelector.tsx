'use client';

import { Select } from '@/components/ui/select';

export function LimitSelector({
  limit,
  onSelectLimit,
}: {
  limit: string;
  onSelectLimit: (limit: string) => void;
}) {
  const options = [
    { label: 'Show 20', value: '20' },
    { label: 'Show 50', value: '50' },
    { label: 'Show 100', value: '100' },
    { label: 'Show All (Slow)', value: 'all' },
  ];

  return (
    <div className="w-40">
      <Select
        value={limit}
        onChange={onSelectLimit}
        options={options}
        placeholder="Select limit"
      />
    </div>
  );
}
