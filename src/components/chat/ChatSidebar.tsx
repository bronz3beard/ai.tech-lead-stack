'use client';

import {
  Check,
  Edit2,
  Folder,
  Github,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  PlusCircle,
  Trash2,
  X,
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
  isPinned: boolean;
}

interface ChatSidebarProps {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  chatId: string | null;
  /**
   * Called when the user explicitly selects an existing chat from the sidebar.
   * ChatPage uses this to update chatId AND increment the mountKey so ChatBody
   * re-mounts to load the selected chat's history.
   */
  onSelectChat: (id: string) => void;
  /**
   * Called when the user clicks "New Chat" or changes project.
   * ChatPage resets chatId to null AND increments mountKey.
   */
  onNewChat: () => void;
  /** Incrementing this value causes the sidebar to re-fetch the chat list */
  refreshKey?: number;
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
  onSelectChat,
  onNewChat,
  refreshKey = 0,
}: ChatSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [projectFetchState, setProjectFetchState] =
    useState<ProjectFetchState>('loading');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

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

  const fetchChats = useCallback(async () => {
    if (!projectId) {
      setChats([]);
      return;
    }
    try {
      const res = await fetch(`/api/chat?projectId=${projectId}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load chats.');
      const data = (await res.json()) as { chats: Chat[] };
      setChats(data.chats);
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, refreshKey]);


  const startNewChat = () => {
    onNewChat();
  };

  const deleteChat = async (id: string) => {
    try {
      const res = await fetch(`/api/chat?chatId=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete chat.');
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (chatId === id) startNewChat();
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  };

  const togglePin = async (chat: Chat) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id, isPinned: !chat.isPinned }),
      });
      if (!res.ok) throw new Error('Failed to toggle pin.');
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, isPinned: !c.isPinned } : c))
      );
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const updateTitle = async (chatId: string, newTitle: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, title: newTitle }),
      });
      if (!res.ok) throw new Error('Failed to update title.');
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
      );
      setEditingChatId(null);
    } catch (err) {
      console.error('Error updating title:', err);
    }
  };

  const startRename = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
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
      <div className="w-80 bg-zinc-900 flex flex-col h-full border-r border-zinc-800">
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
          {chats.length === 0 ? (
            <>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
                History
              </div>
              <div className="text-zinc-600 text-xs italic px-2">
                No past chats.
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Pinned section */}
              {chats.some((c) => c.isPinned) && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-2 px-2 flex items-center gap-2">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </div>
                  {chats
                    .filter((c) => c.isPinned)
                    .map((c) => (
                      <ChatItem
                        key={c.id}
                        chat={c}
                        isActive={chatId === c.id}
                        onSelect={() => onSelectChat(c.id)}
                        onDelete={() => deleteChat(c.id)}
                        onTogglePin={() => togglePin(c)}
                        onRename={() => startRename(c)}
                        isEditing={editingChatId === c.id}
                        editTitle={editTitle}
                        setEditTitle={setEditTitle}
                        onSaveRename={() => updateTitle(c.id, editTitle)}
                        onCancelRename={() => setEditingChatId(null)}
                      />
                    ))}
                </div>
              )}

              {/* Recent section */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-2 px-2">
                  Recent
                </div>
                {chats
                  .filter((c) => !c.isPinned)
                  .map((c) => (
                    <ChatItem
                      key={c.id}
                      chat={c}
                      isActive={chatId === c.id}
                      onSelect={() => onSelectChat(c.id)}
                      onDelete={() => deleteChat(c.id)}
                      onTogglePin={() => togglePin(c)}
                      onRename={() => startRename(c)}
                      isEditing={editingChatId === c.id}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      onSaveRename={() => updateTitle(c.id, editTitle)}
                      onCancelRename={() => setEditingChatId(null)}
                    />
                  ))}
                {chats.filter((c) => !c.isPinned).length === 0 && (
                  <div className="text-zinc-600 text-xs italic px-2">
                    No recent chats.
                  </div>
                )}
              </div>
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

function ChatItem({
  chat,
  isActive,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
  isEditing,
  editTitle,
  setEditTitle,
  onSaveRename,
  onCancelRename,
}: {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: () => void;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
}) {
  return (
    <div
      className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-all duration-200 ${
        isActive
          ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/5'
          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
      }`}
      onClick={isEditing ? undefined : onSelect}
    >
      <div className="flex items-center space-x-2 truncate flex-1 pr-2">
        <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
        {isEditing ? (
          <input
            autoFocus
            className="flex-1 bg-zinc-900 border border-indigo-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">{chat.title}</span>
        )}
      </div>

      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSaveRename();
              }}
              className="hover:text-emerald-400 p-1"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelRename();
              }}
              className="hover:text-red-400 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={chat.isPinned ? 'Unpin' : 'Pin'}
              className={`p-1 transition-colors ${
                chat.isPinned ? 'text-indigo-400 hover:text-indigo-300' : 'hover:text-zinc-200'
              }`}
            >
              {chat.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRename();
              }}
              title="Rename"
              className="hover:text-zinc-200 p-1"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
              className="hover:text-red-400 p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
