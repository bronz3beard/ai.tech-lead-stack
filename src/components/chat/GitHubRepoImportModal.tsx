'use client';

import { Github, Loader2, Search, X, Lock, Globe, CheckCircle2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
}

interface GitHubRepoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the newly registered project after a successful import. */
  onProjectImported: (project: { id: string; name: string }) => void;
}

type FetchState = 'idle' | 'loading' | 'error' | 'success';

/**
 * @desc Modal that lists the signed-in GitHub user's repositories and lets
 *       them register one as a Project in this application. Uses the server
 *       proxy at /api/github/repos so the GitHub token is never exposed.
 */
export default function GitHubRepoImportModal({
  isOpen,
  onClose,
  onProjectImported,
}: GitHubRepoImportModalProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectingRepoId, setConnectingRepoId] = useState<number | null>(null);
  const [connectedRepoIds, setConnectedRepoIds] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    setFetchState('loading');
    setSearchQuery('');

    fetch('/api/github/repos')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { message?: string }).message ?? 'Failed to load repositories.');
        }
        return res.json() as Promise<{ repos: GitHubRepo[] }>;
      })
      .then(({ repos: data }) => {
        setRepos(data);
        setFetchState('success');
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
        setFetchState('error');
      });
  }, [isOpen]);

  const handleConnect = (repo: GitHubRepo) => {
    setConnectingRepoId(repo.id);
    startTransition(async () => {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: repo.name,
            githubFullName: repo.full_name,
            repoUrl: repo.html_url,
            description: repo.description ?? undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { message?: string }).message ?? 'Failed to connect repository.');
        }

        const { project } = (await res.json()) as { project: { id: string; name: string } };
        setConnectedRepoIds((prev) => new Set(prev).add(repo.id));
        onProjectImported(project);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to connect repository. Please try again.');
      } finally {
        setConnectingRepoId(null);
      }
    });
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Github className="h-5 w-5 text-zinc-200" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Connect a Repository</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Select a GitHub repo to use as a project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        {fetchState === 'success' && repos.length > 0 && (
          <div className="p-4 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search repositories…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {fetchState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
              <p className="text-sm text-zinc-400">Loading your repositories…</p>
            </div>
          )}

          {fetchState === 'error' && (
            <div className="p-6 text-center space-y-3">
              <Github className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-sm text-red-400">{errorMessage}</p>
              <p className="text-xs text-zinc-500">
                Please sign out and sign in again with GitHub to refresh your access token.
              </p>
            </div>
          )}

          {fetchState === 'success' && filteredRepos.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm text-zinc-400">No repositories found.</p>
              {searchQuery && (
                <p className="text-xs text-zinc-600">Try clearing your search.</p>
              )}
            </div>
          )}

          {fetchState === 'success' && filteredRepos.length > 0 && (
            <ul className="divide-y divide-zinc-800/60">
              {filteredRepos.map((repo) => {
                const isConnected = connectedRepoIds.has(repo.id);
                const isConnecting = connectingRepoId === repo.id;
                return (
                  <li
                    key={repo.id}
                    className="flex items-start justify-between p-4 hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      {repo.private ? (
                        <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      ) : (
                        <Globe className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{repo.full_name}</p>
                        {repo.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{repo.description}</p>
                        )}
                      </div>
                    </div>

                    {isConnected ? (
                      <div className="flex items-center space-x-1.5 ml-3 shrink-0 text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-medium">Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConnect(repo)}
                        disabled={isConnecting || isPending}
                        className="ml-3 shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5"
                      >
                        {isConnecting && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span>{isConnecting ? 'Connecting…' : 'Connect'}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 rounded-b-2xl">
          <p className="text-[10px] text-zinc-600 text-center">
            Repositories are fetched via your GitHub OAuth token. Only repos you have access to are shown.
          </p>
        </div>
      </div>
    </div>
  );
}
