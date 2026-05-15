'use client';

import { addProjectUser, removeProjectUser, addProjectUserByEmail } from '@/app/settings/actions';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { Loader2, UserPlus, X, MailPlus } from 'lucide-react';
import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface UserGrant {
  id: string;
  userId: string;
  email: string;
  name?: string;
}

export interface UIProjectAccess {
  id: string;
  name: string;
  userGrants: UserGrant[];
  roleGrants: string[];
  hasConfig?: boolean;
}

interface UserSearchResult {
  id: string;
  email: string;
  name?: string;
}

interface ProjectSharingPanelProps {
  initialProjects: Array<UIProjectAccess>;
}

export default function ProjectSharingPanel({
  initialProjects,
}: ProjectSharingPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticProjects, addOptimisticProject] = useOptimistic(
    initialProjects,
    (state, action: { type: string; projectId: string; payload: any }) => {
      return state.map((p) => {
        if (p.id === action.projectId) {
          if (action.type === 'addUser') {
            return {
              ...p,
              userGrants: [...p.userGrants, action.payload],
            };
          }
          if (action.type === 'removeUser') {
            return {
              ...p,
              userGrants: p.userGrants.filter(
                (ug) => ug.userId !== action.payload.userId
              ),
            };
          }
          if (action.type === 'toggleRole') {
            const { role, hasAccess } = action.payload;
            const newGrants = hasAccess
              ? p.roleGrants.filter((r) => r !== role)
              : [...p.roleGrants, role];
            return { ...p, roleGrants: newGrants };
          }
        }
        return p;
      });
    }
  );

  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<
    Record<string, UserSearchResult[]>
  >({});
  const [isSearching, setIsSearching] = useState<Record<string, boolean>>({});

  const handleAddUser = async (projectId: string, user: UserSearchResult) => {
    setSearchQuery((prev) => ({ ...prev, [projectId]: '' }));
    setSearchResults((prev) => ({ ...prev, [projectId]: [] }));

    startTransition(async () => {
      addOptimisticProject({
        type: 'addUser',
        projectId,
        payload: { userId: user.id, email: user.email, name: user.name },
      });
      await addProjectUser(projectId, user.id);
    });
  };

  const handleAddUserByEmail = async (projectId: string, email: string) => {
    setSearchQuery((prev) => ({ ...prev, [projectId]: '' }));
    setSearchResults((prev) => ({ ...prev, [projectId]: [] }));

    startTransition(async () => {
      await addProjectUserByEmail(projectId, email);
    });
  };

  const handleRemoveUser = async (projectId: string, userId: string) => {
    startTransition(async () => {
      addOptimisticProject({
        type: 'removeUser',
        projectId,
        payload: { userId },
      });
      await removeProjectUser(projectId, userId);
    });
  };

  const handleToggleRole = async (projectId: string, role: string, currentlyHasAccess: boolean) => {
    startTransition(async () => {
      addOptimisticProject({
        type: 'toggleRole',
        projectId,
        payload: { role, hasAccess: currentlyHasAccess },
      });
      try {
        await fetch('/api/settings/project-access', {
          method: currentlyHasAccess ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, role }),
        });
        router.refresh();
      } catch (e) {
        console.error(e);
        router.refresh(); // Revert on error
      }
    });
  };

  const searchUsers = async (projectId: string, query: string) => {
    if (query.length < 2) {
      setSearchResults((prev) => ({ ...prev, [projectId]: [] }));
      return;
    }

    setIsSearching((prev) => ({ ...prev, [projectId]: true }));
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults((prev) => ({ ...prev, [projectId]: data.users }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  const isValidEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Project Access Control
          {isPending && (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          )}
        </CardTitle>
        <CardDescription>
          Share your projects with other roles or manage specific user access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {optimisticProjects.length === 0 ? (
          <p className="text-sm text-zinc-400">
            You haven&apos;t connected any projects yet.
          </p>
        ) : (
          <div className="space-y-8">
            {optimisticProjects.map((project) => {
              const currentSearch = searchQuery[project.id] || '';
              const exactEmailMatch = searchResults[project.id]?.some(
                (u) => u.email.toLowerCase() === currentSearch.toLowerCase()
              );
              const showInviteOption = currentSearch.length > 2 && isValidEmail(currentSearch) && !exactEmailMatch;

              return (
                <div
                  key={project.id}
                  className="border border-zinc-800 rounded-lg p-6 bg-zinc-950/50"
                >
                  <h3 className="text-lg font-semibold text-zinc-100 mb-6">
                    {project.name}
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 block">
                        Role-Based Access
                      </Label>
                      <div className="flex flex-wrap gap-6 mb-6">
                        {['DEVELOPER', 'PM', 'QA', 'DESIGNER'].map((role) => {
                          const hasAccess = project.roleGrants.includes(role);
                          return (
                            <div key={role} className="flex items-center space-x-2">
                              <Switch
                                id={`${project.id}-${role}`}
                                checked={hasAccess}
                                onCheckedChange={() =>
                                  handleToggleRole(project.id, role, hasAccess)
                                }
                              />
                              <Label
                                htmlFor={`${project.id}-${role}`}
                                className="text-sm text-zinc-300"
                              >
                                {role}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/50">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 block">
                        Specific User Access
                      </Label>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.userGrants.length === 0 ? (
                          <span className="text-sm text-zinc-500 italic">
                            No specific users assigned.
                          </span>
                        ) : (
                          project.userGrants.map((ug) => (
                            <Badge
                              key={ug.userId}
                              variant="secondary"
                              className="bg-zinc-800 text-zinc-200 py-1 pl-2 pr-1 flex items-center gap-1 border-zinc-700"
                            >
                              <span
                                className="max-w-[200px] truncate"
                                title={ug.email}
                              >
                                {ug.email}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 rounded-full p-0"
                                onClick={() =>
                                  handleRemoveUser(project.id, ug.userId)
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))
                        )}
                      </div>

                      <div className="relative max-w-sm">
                        <div className="relative">
                          <Input
                            placeholder="Add user by email..."
                            value={searchQuery[project.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSearchQuery((prev) => ({
                                ...prev,
                                [project.id]: val,
                              }));
                              searchUsers(project.id, val);
                            }}
                            className="bg-zinc-900 border-zinc-800 pr-8"
                          />
                          {isSearching[project.id] && (
                            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-zinc-500" />
                          )}
                        </div>

                        {((searchResults[project.id]?.length ?? 0) > 0 || showInviteOption) && (
                          <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg overflow-hidden">
                            {searchResults[project.id]?.map((user) => {
                              const alreadyAdded = project.userGrants.some(
                                (ug) => ug.userId === user.id
                              );
                              return (
                                <button
                                  key={user.id}
                                  disabled={alreadyAdded}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 flex items-center justify-between disabled:opacity-50"
                                  onClick={() => handleAddUser(project.id, user)}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-zinc-200">
                                      {user.email}
                                    </span>
                                    {user.name && (
                                      <span className="text-xs text-zinc-500">
                                        {user.name}
                                      </span>
                                    )}
                                  </div>
                                  {!alreadyAdded && (
                                    <UserPlus className="h-4 w-4 text-zinc-500" />
                                  )}
                                </button>
                              );
                            })}
                            {showInviteOption && (
                              <button
                                className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 flex items-center justify-between border-t border-zinc-800"
                                onClick={() => handleAddUserByEmail(project.id, currentSearch)}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-emerald-400">
                                    Grant access to {currentSearch}
                                  </span>
                                  <span className="text-xs text-zinc-500">
                                    They can access this project when they sign up.
                                  </span>
                                </div>
                                <MailPlus className="h-4 w-4 text-emerald-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
