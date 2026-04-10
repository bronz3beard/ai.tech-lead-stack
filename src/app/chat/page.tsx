'use client';

import ChatInput from '@/components/chat/ChatInput';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';

export default function ChatPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    data,
  } = useChat({
    api: '/api/chat',
    body: {
      projectId,
      chatId,
    },
    onResponse: (response: Response) => {
      const newChatId = response.headers.get('x-chat-id');
      if (newChatId && !chatId) {
        setChatId(newChatId);
      }
    },
    onError: (error: Error) => {
      console.error('Chat error:', error);
    },
  });

  // Sync chatId from data stream if available
  useEffect(() => {
    if (data && data.length > 0) {
      const metadata = data.find(
        (d: any) => typeof d === 'object' && d !== null && 'chatId' in d
      );
      if (metadata && (metadata as any).chatId && !chatId) {
        setChatId((metadata as any).chatId);
      }
    }
  }, [data, chatId]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    // const fetchMessages = async () => {};
    // would fetch history
  }, [chatId, setMessages]);

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      <ChatSidebar
        projectId={projectId}
        setProjectId={setProjectId}
        chatId={chatId}
        setChatId={setChatId}
        setMessages={setMessages}
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
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <ChatMessageList messages={messages} isLoading={isLoading} />
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
        )}
      </main>
    </div>
  );
}
