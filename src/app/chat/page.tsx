'use client';

import ChatBody from '@/components/chat/ChatBody';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { useCallback, useState } from 'react';

export default function ChatPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  /**
   * mountKey controls when ChatBody actually re-mounts.
   * It only increments on EXPLICIT user navigation (selecting an existing chat
   * or clicking New Chat). It does NOT change when the server assigns a chatId
   * mid-stream — that would destroy the live useChat instance before it can
   * receive the DONE event and trigger the sidebar refresh.
   */
  const [mountKey, setMountKey] = useState(0);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  const handleChatCreated = useCallback(() => {
    // Incrementing the key causes ChatSidebar to re-fetch the chat list
    setSidebarRefreshKey((k) => k + 1);
  }, []);

  /** User explicitly selected a chat from the sidebar */
  const handleSelectChat = useCallback((id: string) => {
    setChatId(id);
    setMountKey((k) => k + 1); // Re-mount ChatBody to load the selected chat
  }, []);

  /** User clicked New Chat or switched project */
  const handleNewChat = useCallback(() => {
    setChatId(null);
    setMountKey((k) => k + 1); // Re-mount ChatBody to start fresh
  }, []);

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      <ChatSidebar
        projectId={projectId}
        setProjectId={setProjectId}
        chatId={chatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        refreshKey={sidebarRefreshKey}
      />

      <main className="flex-1 flex flex-col min-w-0 border-l border-zinc-800">
        {!projectId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Select a Project</h2>
              <p className="text-zinc-400">
                You must select a project to start a chat.
              </p>
            </div>
          </div>
        ) : (
          <ChatBody
            key={`${projectId}-${mountKey}`}
            projectId={projectId}
            chatId={chatId}
            setChatId={setChatId}
            onChatCreated={handleChatCreated}
          />
        )}
      </main>
    </div>
  );
}
