'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
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
    router.push(`?${params.toString()}`);
    setIsOpen(false);
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
            {selectedProject?.name || 'All Projects'}
          </span>
          <ChevronDown
            className={cn(
              'ml-2 h-4 w-4 text-muted transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-xl border border-border/40 bg-card/95 backdrop-blur-md shadow-lg outline-none ring-1 ring-ring/10 animate-in fade-in zoom-in duration-200"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="project-select-button"
        >
          <div className="py-1" role="none">
            {projects.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">
                No projects found
              </div>
            ) : (
              projects.map((project) => (
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
