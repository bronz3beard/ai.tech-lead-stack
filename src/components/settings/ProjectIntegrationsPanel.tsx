'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Project {
  id: string;
  name: string;
  hasConfig?: boolean;
  settings: {
    discordWebhookUrl?: string;
    discordDevWebhookUrl?: string;
    designSystemPath?: string;
    figmaApiKey?: string;
    chromaticApiKey?: string;
  } | null;
}

interface ProjectFormState {
  discordWebhookUrl: string;
  discordDevWebhookUrl: string;
  designSystemPath: string;
  figmaApiKey: string;
  chromaticApiKey: string;
  isSaving: boolean;
  isSaved: boolean;
}

export default function ProjectIntegrationsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [formState, setFormState] = useState<Record<string, ProjectFormState>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const sortedAndFilteredProjects = useMemo(() => {
    const filtered = projects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      if (a.hasConfig && !b.hasConfig) return -1;
      if (!a.hasConfig && b.hasConfig) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [projects, searchQuery]);

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
            figmaApiKey: p.settings?.figmaApiKey ?? '',
            chromaticApiKey: p.settings?.chromaticApiKey ?? '',
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

  const handleChange = (
    projectId: string,
    field: keyof Pick<
      ProjectFormState,
      | 'discordWebhookUrl'
      | 'discordDevWebhookUrl'
      | 'designSystemPath'
      | 'figmaApiKey'
      | 'chromaticApiKey'
    >,
    value: string
  ) => {
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
      const {
        discordWebhookUrl,
        discordDevWebhookUrl,
        designSystemPath,
        figmaApiKey,
        chromaticApiKey,
      } = formState[projectId];
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            discordWebhookUrl,
            discordDevWebhookUrl,
            designSystemPath,
            figmaApiKey,
            chromaticApiKey,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedProject = data.project;

        // Calculate hasConfig based on the updated settings
        const hasConfig =
          updatedProject.settings &&
          typeof updatedProject.settings === 'object' &&
          Object.values(updatedProject.settings).some(
            (v) =>
              typeof v === 'string' && v.trim().length > 0 && v !== '********'
          );

        // Update the projects list so the ordering refreshes
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, hasConfig: !!hasConfig } : p
          )
        );

        setFormState((prev) => ({
          ...prev,
          [projectId]: { ...prev[projectId], isSaving: false, isSaved: true },
        }));
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save settings');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save settings'); // Quick alert for debugging
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
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search integrations by project name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 bg-zinc-950 border-zinc-800 text-zinc-100"
        />
      </div>

      {sortedAndFilteredProjects.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-lg">
          No projects match your search.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedAndFilteredProjects.map((project) => {
            const state = formState[project.id];
            if (!state) return null;
            return (
              <Card key={project.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {project.name}
                    {project.hasConfig && (
                      <span className="text-[10px] text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                        Configured
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure Discord webhooks for automated notifications.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor={`designer-webhook-${project.id}`}
                      className="text-zinc-300"
                    >
                      Designer Webhook URL
                    </Label>
                    <p className="text-xs text-zinc-500">
                      Pinged when an AI review reaches{' '}
                      <code>READY_FOR_DESIGNER_GATE</code>.
                    </p>
                    <Input
                      id={`designer-webhook-${project.id}`}
                      placeholder="https://discord.com/api/webhooks/..."
                      value={state.discordWebhookUrl}
                      onChange={(e) =>
                        handleChange(
                          project.id,
                          'discordWebhookUrl',
                          e.target.value
                        )
                      }
                      className="bg-zinc-950 border-zinc-700 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`dev-webhook-${project.id}`}
                      className="text-zinc-300"
                    >
                      Developer Webhook URL
                    </Label>
                    <p className="text-xs text-zinc-500">
                      Pinged when a new UI Spec branch is pushed and ready for
                      data wiring.
                    </p>
                    <Input
                      id={`dev-webhook-${project.id}`}
                      placeholder="https://discord.com/api/webhooks/..."
                      value={state.discordDevWebhookUrl}
                      onChange={(e) =>
                        handleChange(
                          project.id,
                          'discordDevWebhookUrl',
                          e.target.value
                        )
                      }
                      className="bg-zinc-950 border-zinc-700 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`design-system-path-${project.id}`}
                      className="text-zinc-300"
                    >
                      Component Output Path
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        (optional — leave blank for auto-detection)
                      </span>
                    </Label>

                    {/* Explanation block */}
                    <div className="rounded-md border border-zinc-700 bg-zinc-950/60 p-3 text-xs text-zinc-400 space-y-2">
                      <p>
                        This tells the AI{' '}
                        <strong className="text-zinc-200">
                          where to place generated UI components
                        </strong>{' '}
                        inside the target repository. It must be a{' '}
                        <strong className="text-zinc-200">
                          relative path from the project root
                        </strong>{' '}
                        — i.e. the folder you see when you open the repo in your
                        code editor.
                      </p>
                      <div className="space-y-1">
                        <p className="text-zinc-500">
                          ✅ Correct (relative paths):
                        </p>
                        <code className="block pl-2 text-emerald-400">
                          libs/gilly-ui/src/components
                        </code>
                        <code className="block pl-2 text-emerald-400">
                          packages/ui/src/components
                        </code>
                        <code className="block pl-2 text-emerald-400">
                          src/components
                        </code>
                      </div>
                      <div className="space-y-1">
                        <p className="text-zinc-500">
                          ❌ Wrong (absolute paths — will be rejected):
                        </p>
                        <code className="block pl-2 text-rose-400">
                          /Users/dan/repos/gilly/libs/gilly-ui/src/components
                        </code>
                        <code className="block pl-2 text-rose-400">
                          ~/repos/gilly/src/components
                        </code>
                        <code className="block pl-2 text-rose-400">
                          C:\repos\gilly\src\components
                        </code>
                      </div>
                    </div>

                    <Input
                      id={`design-system-path-${project.id}`}
                      placeholder="e.g. libs/gilly-ui/src/components"
                      value={state.designSystemPath}
                      onChange={(e) =>
                        handleChange(
                          project.id,
                          'designSystemPath',
                          e.target.value
                        )
                      }
                      className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono text-sm"
                    />

                    {/* Client-side absolute path warning */}
                    {state.designSystemPath &&
                      (state.designSystemPath.startsWith('/') ||
                        state.designSystemPath.startsWith('~') ||
                        /^[A-Za-z]:\\/.test(state.designSystemPath)) && (
                        <p className="text-xs text-rose-400 flex items-center gap-1">
                          ⚠️ This looks like an absolute path. Please enter a
                          path relative to your project root (e.g.{' '}
                          <code>libs/gilly-ui/src/components</code>).
                        </p>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor={`figma-api-key-${project.id}`}
                        className="text-zinc-300 flex items-center justify-between"
                      >
                        Figma API Key
                        {state.figmaApiKey === '********' && (
                          <span className="text-[10px] text-emerald-500 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Configured
                          </span>
                        )}
                      </Label>
                      <Input
                        id={`figma-api-key-${project.id}`}
                        type="password"
                        placeholder="figd_..."
                        value={state.figmaApiKey}
                        onChange={(e) =>
                          handleChange(
                            project.id,
                            'figmaApiKey',
                            e.target.value
                          )
                        }
                        className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor={`chromatic-api-key-${project.id}`}
                        className="text-zinc-300 flex items-center justify-between"
                      >
                        Chromatic API Key
                        {state.chromaticApiKey === '********' && (
                          <span className="text-[10px] text-emerald-500 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Configured
                          </span>
                        )}
                      </Label>
                      <Input
                        id={`chromatic-api-key-${project.id}`}
                        type="password"
                        placeholder="ch_..."
                        value={state.chromaticApiKey}
                        onChange={(e) =>
                          handleChange(
                            project.id,
                            'chromaticApiKey',
                            e.target.value
                          )
                        }
                        className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono text-xs"
                      />
                    </div>
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
      )}
    </div>
  );
}
