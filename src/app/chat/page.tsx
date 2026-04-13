'use client';

import ChatInput from '@/components/chat/ChatInput';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useState, useMemo } from 'react';

function ChatBody({ 
  projectId, 
  chatId, 
  setChatId 
}: { 
  projectId: string; 
  chatId: string | null; 
  setChatId: (id: string | null) => void;
}) {
  const [input, setInput] = useState('');

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
  
  const [streamData, setStreamData] = useState<any[]>([]);

  const { messages, status, sendMessage, error, setMessages } = useChat({
    transport,
    onData: (data: unknown) => {
      // Manage custom status updates
      setStreamData((prev) => [...prev, data]);

      if (typeof data === 'object' && data !== null && 'chatId' in data) {
        const payload = data as { chatId?: string };
        if (payload.chatId && !chatId) {
          setChatId(payload.chatId);
        }
      }
    },
    onError: (error: Error) => {
      console.error('Chat error:', error);
    },
  });

  const isLoading = status === 'streaming';

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // In AI SDK v6, passing body here is a robust backup to transport config
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
  const [messages, setMessages] = useState<any[]>([]); // Used by sidebar to clear state

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
          <ChatBody 
            key={projectId} // Force re-mount on project change
            projectId={projectId}
            chatId={chatId}
            setChatId={setChatId}
          />
        )}
      </main>
    </div>
  );
}
