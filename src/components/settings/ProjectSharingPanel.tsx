'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ProjectAccess {
  id: string;
  name: string;
  accessGrants: ('PM' | 'QA' | 'DESIGNER' | 'DEVELOPER')[];
}

export default function ProjectSharingPanel() {
  const [projects, setProjects] = useState<ProjectAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/settings/project-access');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (projectId: string, role: string, currentlyHasAccess: boolean) => {
    // Optimistic update
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const grants = currentlyHasAccess
          ? p.accessGrants.filter(g => g !== role)
          : [...p.accessGrants, role as any];
        return { ...p, accessGrants: grants };
      }
      return p;
    }));

    try {
      await fetch('/api/settings/project-access', {
        method: currentlyHasAccess ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, role }),
      });
    } catch (e) {
      console.error(e);
      // Revert optimistic update on error
      fetchProjects();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle>My Projects</CardTitle>
        <CardDescription>Share your projects with other roles to allow them to chat about the codebase.</CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-400">You haven't connected any projects yet.</p>
        ) : (
          <div className="space-y-6">
            {projects.map(project => (
              <div key={project.id} className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/50">
                <h3 className="font-medium text-zinc-200 mb-4">{project.name}</h3>
                <div className="flex flex-wrap gap-6">
                  {['DEVELOPER', 'PM', 'QA', 'DESIGNER'].map(role => {
                    const hasAccess = project.accessGrants.includes(role as any);
                    return (
                      <div key={role} className="flex items-center space-x-2">
                        <Switch
                          id={`${project.id}-${role}`}
                          checked={hasAccess}
                          onCheckedChange={() => handleToggle(project.id, role, hasAccess)}
                        />
                        <Label htmlFor={`${project.id}-${role}`} className="text-sm text-zinc-300">
                          {role}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
