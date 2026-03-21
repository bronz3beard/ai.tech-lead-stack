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
  return (
    <div className="w-64">
      <Select
        value={selectedProject}
        onChange={onSelectProject}
        options={projects.map((p) => ({ label: p, value: p }))}
      />
    </div>
  );
}
