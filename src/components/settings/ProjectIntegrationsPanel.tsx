'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  settings: {
    discordWebhookUrl?: string;
    discordDevWebhookUrl?: string;
    designSystemPath?: string;
  } | null;
}

interface ProjectFormState {
  discordWebhookUrl: string;
  discordDevWebhookUrl: string;
  designSystemPath: string;
  isSaving: boolean;
  isSaved: boolean;
}

export default function ProjectIntegrationsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [formState, setFormState] = useState<Record<string, ProjectFormState>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const fetched: Project[] = data.projects ?? [];
        setProjects(fetched);
        // Initialise form state from existing settings
        const initialState: Record<string, ProjectFormState> = {};
        for (const p of fetched) {
          initialState[p.id] = {
            discordWebhookUrl: p.settings?.discordWebhookUrl ?? '',
            discordDevWebhookUrl: p.settings?.discordDevWebhookUrl ?? '',
            designSystemPath: p.settings?.designSystemPath ?? '',
            isSaving: false,
            isSaved: false,
          };
        }
        setFormState(initialState);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchProjects();
    };
    init();
  }, [fetchProjects]);

  const handleChange = (projectId: string, field: keyof Pick<ProjectFormState, 'discordWebhookUrl' | 'discordDevWebhookUrl' | 'designSystemPath'>, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], [field]: value, isSaved: false },
    }));
  };

  const handleSave = async (projectId: string) => {
    setFormState((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], isSaving: true },
    }));

    try {
      const { discordWebhookUrl, discordDevWebhookUrl, designSystemPath } = formState[projectId];
      await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { discordWebhookUrl, discordDevWebhookUrl, designSystemPath },
        }),
      });
      setFormState((prev) => ({
        ...prev,
        [projectId]: { ...prev[projectId], isSaving: false, isSaved: true },
      }));
    } catch (e) {
      console.error(e);
      setFormState((prev) => ({
        ...prev,
        [projectId]: { ...prev[projectId], isSaving: false },
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        You haven&apos;t connected any projects yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const state = formState[project.id];
        if (!state) return null;
        return (
          <Card key={project.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <CardDescription>
                Configure Discord webhooks for automated notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`designer-webhook-${project.id}`} className="text-zinc-300">
                  Designer Webhook URL
                </Label>
                <p className="text-xs text-zinc-500">
                  Pinged when an AI review reaches <code>READY_FOR_DESIGNER_GATE</code>.
                </p>
                <Input
                  id={`designer-webhook-${project.id}`}
                  placeholder="https://discord.com/api/webhooks/..."
                  value={state.discordWebhookUrl}
                  onChange={(e) => handleChange(project.id, 'discordWebhookUrl', e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`dev-webhook-${project.id}`} className="text-zinc-300">
                  Developer Webhook URL
                </Label>
                <p className="text-xs text-zinc-500">
                  Pinged when a new UI Spec branch is pushed and ready for data wiring.
                </p>
                <Input
                  id={`dev-webhook-${project.id}`}
                  placeholder="https://discord.com/api/webhooks/..."
                  value={state.discordDevWebhookUrl}
                  onChange={(e) => handleChange(project.id, 'discordDevWebhookUrl', e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`design-system-path-${project.id}`} className="text-zinc-300">
                  Component Output Path
                </Label>
                <p className="text-xs text-zinc-500">
                  Where should the AI place generated UI components? Leave blank for auto-detection.
                  <br />
                  <span className="font-mono text-zinc-400">e.g. libs/gilly-ui/src/components</span>
                </p>
                <Input
                  id={`design-system-path-${project.id}`}
                  placeholder="libs/my-ui/src/components or leave blank to auto-detect"
                  value={state.designSystemPath}
                  onChange={(e) => handleChange(project.id, 'designSystemPath', e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleSave(project.id)}
                  disabled={state.isSaving}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {state.isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save
                </Button>
                {state.isSaved && (
                  <span className="flex items-center gap-1 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
