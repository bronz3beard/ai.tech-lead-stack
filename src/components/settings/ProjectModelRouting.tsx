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
import { Select } from '@/components/ui/select';
import { CheckCircle2, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RESPONSIBILITIES,
  Responsibility,
  getModelOptions,
} from '@/lib/ai/model-routing-schema';

interface Project {
  id: string;
  name: string;
  settings: Record<string, unknown> | null;
}

interface EffectiveModel {
  model: string;
  source: 'env' | 'project' | 'user' | 'default';
}

interface ProjectRoutingState {
  routing: Record<Responsibility, string>;
  effective: Record<Responsibility, EffectiveModel>;
  isSaving: boolean;
  isSaved: boolean;
}

interface KeysStatus {
  anthropic: boolean;
  gemini: boolean;
  openai: boolean;
  jules: boolean;
}

const RESPONSIBILITY_LABELS: Record<Responsibility, string> = {
  planner: 'Planner Agent Model',
  implementer: 'Implementer Agent Model',
  auditor: 'Auditor Agent Model',
  adjudicator: 'Adjudicator Agent Model',
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  openai: 'OpenAI',
  jules: 'Jules',
};

function formatEffectiveText(effective?: EffectiveModel): string | null {
  if (!effective) return null;
  const { model, source } = effective;
  switch (source) {
    case 'project':
      return `Using ${model} — set on this project`;
    case 'user':
      return `Using ${model} — inherited from your defaults`;
    case 'env':
      return `Using ${model} — set in environment (.env)`;
    case 'default':
    default:
      return `Using ${model} — system default`;
  }
}

export default function ProjectModelRouting() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [keysStatus, setKeysStatus] = useState<KeysStatus | null>(null);
  const [formState, setFormState] = useState<Record<string, ProjectRoutingState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const modelOptions = getModelOptions();

  const sortedAndFilteredProjects = useMemo(() => {
    return projects
      .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, searchQuery]);

  const loadData = useCallback(async () => {
    try {
      const [projectsRes, keysRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/settings/keys-status'),
      ]);

      if (keysRes.ok) {
        setKeysStatus(await keysRes.json());
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        const fetched: Project[] = data.projects ?? [];
        setProjects(fetched);

        const stateAcc: Record<string, ProjectRoutingState> = {};
        await Promise.all(
          fetched.map(async (p) => {
            try {
              const res = await fetch(`/api/projects/${p.id}/model-routing`);
              if (res.ok) {
                const body = await res.json();
                stateAcc[p.id] = {
                  routing: {
                    planner: body.routing?.planner || '',
                    implementer: body.routing?.implementer || '',
                    auditor: body.routing?.auditor || '',
                    adjudicator: body.routing?.adjudicator || '',
                  },
                  effective: body.effective || {},
                  isSaving: false,
                  isSaved: false,
                };
              }
            } catch (err) {
              console.error(`Failed to load routing for project ${p.id}`, err);
            }
          })
        );
        setFormState(stateAcc);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = (
    projectId: string,
    role: Responsibility,
    value: string
  ) => {
    setFormState((prev) => {
      const pState = prev[projectId];
      if (!pState) return prev;
      return {
        ...prev,
        [projectId]: {
          ...pState,
          routing: {
            ...pState.routing,
            [role]: value,
          },
          isSaved: false,
        },
      };
    });
  };

  const handleSave = async (projectId: string) => {
    setFormState((prev) => {
      const pState = prev[projectId];
      if (!pState) return prev;
      return {
        ...prev,
        [projectId]: { ...pState, isSaving: true },
      };
    });

    try {
      const pState = formState[projectId];
      const res = await fetch(`/api/projects/${projectId}/model-routing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pState.routing),
      });

      if (res.ok) {
        // Re-fetch GET to update effective sources accurately
        const getRes = await fetch(`/api/projects/${projectId}/model-routing`);
        if (getRes.ok) {
          const body = await getRes.json();
          setFormState((prev) => ({
            ...prev,
            [projectId]: {
              routing: {
                planner: body.routing?.planner || '',
                implementer: body.routing?.implementer || '',
                auditor: body.routing?.auditor || '',
                adjudicator: body.routing?.adjudicator || '',
              },
              effective: body.effective || {},
              isSaving: false,
              isSaved: true,
            },
          }));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save project routing');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save project routing');
      setFormState((prev) => {
        const pState = prev[projectId];
        if (!pState) return prev;
        return {
          ...prev,
          [projectId]: { ...pState, isSaving: false },
        };
      });
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
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search projects by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-zinc-950 border-zinc-800 text-zinc-100"
        />
      </div>

      {sortedAndFilteredProjects.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-lg">
          No projects match your search.
        </p>
      ) : (
        <div className="space-y-6">
          {sortedAndFilteredProjects.map((project) => {
            const pState = formState[project.id];
            if (!pState) return null;

            return (
              <Card key={project.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-base text-zinc-200">
                    {project.name}
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Set per-project AI model overrides. Project routing takes priority over user defaults.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {RESPONSIBILITIES.map((role) => {
                      const selectedVal = pState.routing[role] || '';
                      const selectedOpt = modelOptions.find((o) => o.value === selectedVal);
                      const isKeyMissing =
                        selectedOpt?.keySlot &&
                        keysStatus &&
                        keysStatus[selectedOpt.keySlot] === false;
                      const effectiveInfo = pState.effective?.[role];

                      return (
                        <div key={role} className="space-y-1.5">
                          <Label
                            htmlFor={`proj-${project.id}-${role}`}
                            className="text-zinc-300 text-sm"
                          >
                            {RESPONSIBILITY_LABELS[role]}
                          </Label>
                          <Select
                            value={selectedVal}
                            onChange={(val) =>
                              handleRoleChange(project.id, role, val)
                            }
                            options={modelOptions}
                          />
                          {effectiveInfo && (
                            <p className="text-xs text-zinc-400">
                              {formatEffectiveText(effectiveInfo)}
                            </p>
                          )}
                          {isKeyMissing && selectedOpt?.keySlot && (
                            <p className="text-xs text-amber-400 mt-1">
                              No {PROVIDER_NAMES[selectedOpt.keySlot] || selectedOpt.keySlot} key — add one in the API Keys tab
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={() => handleSave(project.id)}
                      disabled={pState.isSaving}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {pState.isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Save Changes
                    </Button>
                    {pState.isSaved && (
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
