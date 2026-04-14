'use client';

import ChatInput from '@/components/chat/ChatInput';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';

function ChatBody({ 
  projectId, 
  chatId, 
  setChatId,
  onChatCreated,
}: { 
  projectId: string; 
  chatId: string | null; 
  setChatId: (id: string | null) => void;
  onChatCreated: () => void;
}) {
  const [input, setInput] = useState('');
  // Track whether onChatCreated has been called for this chat session
  const chatCreatedNotified = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          projectId,
          chatId,
        },
      }),
    [projectId, chatId]
  );
  
  const [messagesInitialized, setMessagesInitialized] = useState(false);
  const [streamData, setStreamData] = useState<any[]>([]);

  const { messages, status, sendMessage, error, setMessages } = useChat({
    transport,
    onData: (data: unknown) => {
      // Manage custom status updates
      setStreamData((prev) => [...prev, data]);

      // The AI SDK delivers `data-custom` stream events as:
      //   { id: string, data: { chatId?: string, status?: string, ... } }
      // We must unwrap the inner `.data` payload before checking fields.
      const payload =
        typeof data === 'object' && data !== null && 'data' in data
          ? (data as { data: Record<string, unknown> }).data
          : typeof data === 'object' && data !== null
          ? (data as Record<string, unknown>)
          : {};

      // ── Sidebar refresh trigger #1: chatId assignment ─────────────────────
      // Fires IMMEDIATELY when the server assigns a chatId (very early in the
      // stream) so the entry appears in the sidebar while the agent is still
      // responding. The title will initially be 'New Chat' and update on DONE.
      if (typeof payload.chatId === 'string' && payload.chatId && !chatId) {
        setChatId(payload.chatId);
        if (!chatCreatedNotified.current) {
          chatCreatedNotified.current = true;
          onChatCreated();
        }
      }

      // ── Sidebar refresh trigger #2: DONE signal ───────────────────────────
      // After streaming completes the server writes the auto-generated title
      // to the DB. We delay 600ms to let that write land, then re-fetch so the
      // sidebar shows the real title instead of 'New Chat'.
      if (
        typeof payload.status === 'string' &&
        payload.status.startsWith('DONE:')
      ) {
        setTimeout(onChatCreated, 600);
      }
    },
    onError: (error: Error) => {
      console.error('Chat error:', error);
    },
  });

  // Load initial messages for existing chats
  useEffect(() => {
    if (chatId && !messagesInitialized) {
      const fetchHistory = async () => {
        try {
          const res = await fetch(`/api/chat?chatId=${chatId}`);
          if (!res.ok) return;
          const data = (await res.json()) as { messages: any[] };
          if (data.messages) {
            setMessages(data.messages);
          }
        } catch (err) {
          console.error('Failed to load chat history:', err);
        } finally {
          setMessagesInitialized(true);
        }
      };
      fetchHistory();
    } else if (!chatId) {
      setMessages([]);
      setMessagesInitialized(true);
    }
  }, [chatId, messagesInitialized, setMessages]);

  const isLoading = status === 'streaming';

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Reset the notified flag so the next message can trigger a refresh
    chatCreatedNotified.current = false;
    setStreamData([]); // Clear old status updates
    sendMessage(
      { parts: [{ type: 'text', text: input }] },
      { body: { projectId, chatId } }
    );
    setInput('');
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <ChatMessageList 
          messages={messages} 
          data={streamData}
          isLoading={isLoading} 
        />
        {error && (
          <div className="p-4 mt-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
            {error.message || 'An error occurred.'}
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <ChatInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}

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
    // Incrementing the key causes ChatSidebar to re-fetch its chat list
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

