'use client';

import { Select } from '@/components/ui/select';

export function ProjectSelector({
  projects,
  selectedProject,
  onSelectProject,
}: {
  projects: string[];
  selectedProject: string;
  onSelectProject: (project: string) => void;
}) {
  // Ensure 'all' is an option if projects exist
  const options = [
    { label: 'All Projects', value: 'all' },
    ...projects.map((p) => ({ label: p, value: p }))
  ];

  return (
    <div className="w-64">
      <Select
        value={selectedProject || 'all'}
        onChange={onSelectProject}
        options={options}
      />
    </div>
  );
}
