'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
}

export default function SharedProjectsReadOnly() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
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
    fetchProjects();
  }, []);

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
        <CardTitle>Shared Projects</CardTitle>
        <CardDescription>
          Developers control which projects you can access. Projects shared with your role appear here and in the chat sidebar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-400">No projects have been shared with your role yet.</p>
        ) : (
          <div className="space-y-4">
            {projects.map(project => (
              <div key={project.id} className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/50">
                <h3 className="font-medium text-zinc-200">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-zinc-400 mt-1">{project.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
