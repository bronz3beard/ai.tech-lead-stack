'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat, UIMessage } from '@ai-sdk/react';
import { Settings, Send, Loader2, Bot, User, Check, X } from 'lucide-react';
import AiSettingsModal from './AiSettingsModal';

interface SkillAssistantProps {
  currentContent: string;
  onUpdateContent: (content: string) => void;
}

export default function SkillAssistant({ currentContent, onUpdateContent }: SkillAssistantProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ provider: string, apiKey: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial credentials
    const provider = localStorage.getItem('ai_provider') || 'openai';
    const apiKey = localStorage.getItem(`ai_key_${provider}`);
    if (provider && apiKey) {
      setCredentials({ provider, apiKey });
    }
  }, [isSettingsOpen]); // Re-load when settings modal closes

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/skills/chat',
    body: {
      provider: credentials?.provider,
      apiKey: credentials?.apiKey,
      currentContent,
    },
    onError: (error: Error) => {
      console.error('Chat error:', error);
      if (error.message.includes('API key is required')) {
        setIsSettingsOpen(true);
      }
    }
  } as any) as any;

  const handleAutoAnalyze = () => {
    if (!credentials?.apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    append({
      role: 'user',
      content: 'Please analyze my current skill content. Validate the ethos, format it, and check the schema. Let me know if there are any issues or suggestions for improvement.',
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleApplyFix = (content: string) => {
    onUpdateContent(content);
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-sm">AI Assistant</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAutoAnalyze}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium transition-colors"
            title="Auto-Analyze Draft"
          >
            Analyze
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-3 opacity-70">
            <Bot className="w-10 h-10 mb-2 text-muted-foreground" />
            <p className="text-sm">I can help you build, format, and validate your skill.</p>
            <p className="text-xs">Click <strong>Analyze</strong> or ask me a question.</p>
          </div>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-center space-x-2 mb-1 ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                  {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </span>
              </div>
              <div className={`px-3 py-2 rounded-lg max-w-[90%] text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-muted text-foreground rounded-tl-none'}`}>
                <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap">
                  {m.content}
                </div>
                {/* Tool Invocations UI */}
                {m.toolInvocations && m.toolInvocations.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-border/50 pt-2">
                    {m.toolInvocations.map((tool: any) => (
                      <div key={tool.toolCallId} className="bg-background/50 rounded p-2 text-xs border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            🛠️ {tool.toolName}
                          </span>
                          {tool.state === 'result' ? <Check className="w-3 h-3 text-green-500" /> : <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </div>
                        {tool.state === 'result' && tool.toolName === 'lint_and_format' && tool.result?.formattedContent && (
                          <div className="mt-2 text-right">
                            <button
                              onClick={() => handleApplyFix(tool.result.formattedContent)}
                              className="px-2 py-1 bg-green-100 text-green-800 hover:bg-green-200 rounded text-xs font-medium transition-colors"
                            >
                              Apply Formatting
                            </button>
                          </div>
                        )}
                        {/* Display basic result for validation */}
                        {tool.state === 'result' && tool.toolName === 'validate_ethos' && (
                           <div className="mt-1 font-mono text-[10px] max-h-20 overflow-y-auto bg-black/5 p-1 rounded opacity-80">
                             {tool.result?.output || tool.result?.error || 'Done'}
                           </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Assistant is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-border bg-background">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            className="w-full pl-3 pr-10 py-2 border border-border rounded-full text-sm bg-muted focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            value={input}
            placeholder={credentials?.apiKey ? "Ask for review or suggestions..." : "Set API key to chat..."}
            onChange={handleInputChange}
            disabled={!credentials?.apiKey || isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || !credentials?.apiKey || isLoading}
            className="absolute right-1 p-1.5 rounded-full text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <AiSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
