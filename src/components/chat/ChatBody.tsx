'use client';

import ChatInput from '@/components/chat/ChatInput';
import ChatMessageList from '@/components/chat/ChatMessageList';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface ChatBodyProps {
  projectId: string;
  chatId: string | null;
  setChatId: (id: string | null) => void;
  onChatCreated: () => void;
}

/**
 * @desc Self-contained chat UI panel. Handles message streaming, history
 * loading, and sidebar refresh triggers. Extracted from chat/page.tsx so it
 * can be embedded in the dedicated /design-review session view as well.
 *
 * @param projectId - The project context for this chat session.
 * @param chatId - Existing chat ID to resume, or null to start fresh.
 * @param setChatId - Called when the server assigns a chatId for a new chat.
 * @param onChatCreated - Called on first message and on DONE to refresh parents.
 */
export default function ChatBody({
  projectId,
  chatId,
  setChatId,
  onChatCreated,
}: ChatBodyProps) {
  const [input, setInput] = useState('');
  const [messagesInitialized, setMessagesInitialized] = useState(false);
  const [streamData, setStreamData] = useState<any[]>([]);
  // Handle chatId change during render to avoid sync setState in effect
  const [prevChatId, setPrevChatId] = useState(chatId);

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

  const { messages, status, sendMessage, error, setMessages } = useChat({
    transport,
    onData: (data: unknown) => {
      setStreamData((prev) => [...prev, data]);

      const payload =
        typeof data === 'object' && data !== null && 'data' in data
          ? (data as { data: Record<string, unknown> }).data
          : typeof data === 'object' && data !== null
            ? (data as Record<string, unknown>)
            : {};

      // Sidebar refresh #1: chatId assignment (fires early so entry appears while streaming)
      if (typeof payload.chatId === 'string' && payload.chatId && !chatId) {
        setChatId(payload.chatId);
        if (!chatCreatedNotified.current) {
          chatCreatedNotified.current = true;
          onChatCreated();
        }
      }

      // Sidebar refresh #2: DONE signal (600ms delay lets the title DB write land)
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

  if (chatId !== prevChatId) {
    setPrevChatId(chatId);
    if (!chatId) {
      setMessages([]);
      setMessagesInitialized(true);
    }
  }

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
    }
  }, [chatId, messagesInitialized, setMessages]);

  const isLoading = status === 'streaming';

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    chatCreatedNotified.current = false;
    setStreamData([]);
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
