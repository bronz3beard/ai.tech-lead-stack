'use client';

import { useState, useRef, useEffect, useTransition, useMemo } from 'react';
import { ChevronDown, Check, Loader2, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Utility function to merge tailwind classes safely.
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Project = {
  id: string;
  name: string;
  hasConfig?: boolean;
};

interface ProjectSelectProps {
  projects: Project[];
  selectedProjectId: string;
}

/**
 * @desc Custom Project Select component to match the G-Stack design system.
 * @param {ProjectSelectProps} props
 * @returns {JSX.Element}
 */
export function ProjectSelect({
  projects,
  selectedProjectId,
}: ProjectSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];

  const sortedAndFilteredProjects = useMemo(() => {
    // 1. Filter
    const filtered = projects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Sort: 'all' always first, then config true, then config false, then alpha
    return filtered.sort((a, b) => {
      if (a.id === 'all') return -1;
      if (b.id === 'all') return 1;

      if (a.hasConfig && !b.hasConfig) return -1;
      if (!a.hasConfig && b.hasConfig) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [projects, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery(''); // Reset search on close
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('projectId', id);
    
    startTransition(() => {
      router.push(`?${params.toString()}`);
      setIsOpen(false);
      setSearchQuery('');
    });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-between w-full max-w-64 rounded-xl border border-border/40 bg-card/50 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-ring/20 shadow-sm"
          id="project-select-button"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <span className="flex items-center gap-2 truncate">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : null}
            {selectedProject?.name || 'All Projects'}
          </span>
          <ChevronDown
            className={cn(
              'ml-2 h-4 w-4 text-muted transition-transform duration-200',
              isOpen && 'rotate-180',
              isPending && 'opacity-50'
            )}
          />
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-xl border border-border/40 bg-card/95 backdrop-blur-md shadow-lg outline-none ring-1 ring-ring/10 animate-in fade-in zoom-in duration-200 flex flex-col"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="project-select-button"
        >
          <div className="p-2 border-b border-border/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background/50 border border-border/40 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="py-1 max-h-60 overflow-y-auto" role="none">
            {sortedAndFilteredProjects.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">
                No projects found
              </div>
            ) : (
              sortedAndFilteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project.id)}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-accent/50',
                    project.id === selectedProjectId
                      ? 'bg-accent/30 font-semibold text-foreground'
                      : 'text-muted hover:text-foreground'
                  )}
                  role="menuitem"
                >
                  <span className="truncate">{project.name}</span>
                  {project.id === selectedProjectId && (
                    <Check className="ml-2 h-4 w-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
