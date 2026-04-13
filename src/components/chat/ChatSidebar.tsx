'use client';

import { UIMessage } from '@ai-sdk/react';
import {
  Folder,
  Github,
  Loader2,
  MessageSquare,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import GitHubRepoImportModal from './GitHubRepoImportModal';

interface Project {
  id: string;
  name: string;
  githubFullName?: string | null;
}

interface Chat {
  id: string;
  title: string;
  projectId: string;
}

interface ChatSidebarProps {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  chatId: string | null;
  setChatId: (id: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
}

type ProjectFetchState = 'loading' | 'empty' | 'loaded' | 'error';

/**
 * @desc Sidebar for the chat interface. Fetches the signed-in developer's
 *       registered GitHub projects from /api/projects. When none exist, shows
 *       an empty state with a CTA to connect a GitHub repository via the
 *       GitHubRepoImportModal.
 */
export default function ChatSidebar({
  projectId,
  setProjectId,
  chatId,
  setChatId,
  setMessages,
}: ChatSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [projectFetchState, setProjectFetchState] =
    useState<ProjectFetchState>('loading');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setProjectFetchState('loading');
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects.');
      const data = (await res.json()) as { projects: Project[] };
      setProjects(data.projects);
      setProjectFetchState(data.projects.length === 0 ? 'empty' : 'loaded');
    } catch {
      setProjectFetchState('error');
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // When projectId changes, clear chat history (future: fetch real history)
  useEffect(() => {
    setChats([]);
  }, [projectId]);

  const startNewChat = () => {
    setChatId(null);
    setMessages([]);
  };

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (chatId === id) startNewChat();
  };

  const handleProjectImported = (project: Project) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === project.id);
      return exists ? prev : [project, ...prev];
    });
    setProjectFetchState('loaded');
    setProjectId(project.id);
    startNewChat();
  };

  return (
    <>
      <div className="w-64 bg-zinc-900 flex flex-col h-full border-r border-zinc-800">
        {/* Project selector */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Select Project
            </label>
            {projectFetchState === 'loaded' && (
              <button
                onClick={() => setIsModalOpen(true)}
                title="Connect another repository"
                aria-label="Connect another GitHub repository"
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Loading skeleton */}
          {projectFetchState === 'loading' && (
            <div className="flex items-center space-x-2 py-2">
              <Loader2 className="h-4 w-4 text-zinc-600 animate-spin" />
              <span className="text-xs text-zinc-600">Loading projects…</span>
            </div>
          )}

          {/* Error state */}
          {projectFetchState === 'error' && (
            <p className="text-xs text-red-400 py-1">
              Failed to load projects.
            </p>
          )}

          {/* Empty state — no projects registered yet */}
          {projectFetchState === 'empty' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full flex flex-col items-center justify-center space-y-2 py-5 px-3 border border-dashed border-zinc-700 rounded-lg text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 hover:bg-indigo-950/20 transition-all group"
            >
              <Github className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-center leading-relaxed">
                No projects connected.
                <br />
                <span className="text-indigo-400 font-medium">
                  Connect a GitHub repo
                </span>
              </span>
            </button>
          )}

          {/* Project dropdown */}
          {projectFetchState === 'loaded' && (
            <div className="relative">
              <Folder className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              <select
                id="project-select"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 pl-9 pr-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                value={projectId ?? ''}
                onChange={(e) => {
                  setProjectId(e.target.value || null);
                  startNewChat();
                }}
              >
                <option value="" disabled>
                  Choose a project…
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={startNewChat}
            disabled={!projectId}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed text-white rounded-md py-2 px-4 transition-colors text-sm font-medium"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
            History
          </div>
          {chats.length === 0 ? (
            <div className="text-zinc-600 text-xs italic px-2">
              No past chats.
            </div>
          ) : (
            <div className="space-y-1">
              {chats.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm ${
                    chatId === c.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                  onClick={() => setChatId(c.id)}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(c.id);
                    }}
                    aria-label={`Delete chat: ${c.title}`}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Read-only badge */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/20">
          <div className="flex items-center space-x-2 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg shadow-sm">
            <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
              Read-Only Analysis Mode
            </span>
          </div>
        </div>
      </div>

      <GitHubRepoImportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectImported={handleProjectImported}
      />
    </>
  );
}
