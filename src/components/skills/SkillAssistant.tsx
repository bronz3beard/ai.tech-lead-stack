'use client';

import { cn } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  Send,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StreamingIndicator from '../chat/StreamingIndicator';

// ---------------------------------------------------------------------------
// Type Guards & Utilities
// ---------------------------------------------------------------------------

interface TextPart {
  type: 'text';
  text: string;
}
interface ReasoningPart {
  type: 'reasoning';
  text: string;
}
interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
}
interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
}
interface UnknownPart {
  type: string;
  [key: string]: any;
}

type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolCallPart
  | ToolResultPart
  | UnknownPart;

function isTextPart(part: MessagePart): part is TextPart {
  return part.type === 'text';
}
function isReasoningPart(part: MessagePart): part is ReasoningPart {
  return part.type === 'reasoning';
}
function isToolCallPart(part: MessagePart): part is ToolCallPart {
  return part.type === 'tool-call';
}
function isToolResultPart(part: MessagePart): part is ToolResultPart {
  return part.type === 'tool-result';
}

interface StreamDataPayload {
  status?: string;
  insights?: string[];
  error?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface SkillAssistantProps {
  currentContent: string;
  onUpdateContent: (content: string) => void;
}

export default function SkillAssistant({
  currentContent,
  onUpdateContent,
}: SkillAssistantProps) {
  const [input, setInput] = useState('');
  const [streamData, setStreamData] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/skills/chat',
        body: {
          currentContent,
        },
      }),
    [currentContent]
  );

  const { messages, status, sendMessage, error, setMessages } = useChat({
    transport,
    onData: (data: any) => {
      setStreamData((prev) => [
        ...prev,
        ...(Array.isArray(data) ? data : [data]),
      ]);
    },
    onError: (err: Error) => {
      console.error('Chat error:', err);
    },
  });

  const isLoading = status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    setStreamData([]); // Clear previous turn's progress
    sendMessage({
      parts: [
        {
          type: 'text',
          text: input,
        },
      ],
    });
    setInput('');
  };

  const handleApplyFix = (newContent: string, summary: string) => {
    onUpdateContent(newContent);
    setMessages((prev) => [
      ...prev,
      {
        id: `apply-${Date.now()}`,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `✅ **Applied proposed refinement:**\n\n${summary}`,
          },
        ],
      },
    ]);
  };

  const handleAutoAnalyze = () => {
    if (isLoading) return;
    setStreamData([]);
    sendMessage({
      parts: [
        {
          type: 'text',
          text: 'Analyze my current skill draft and suggest improvements based on G-Stack and MinimumCD ethos.',
        },
      ],
    });
  };

  // Derive status and insights from streamData
  const payloads = (streamData?.map((d) =>
    typeof d === 'object' && d !== null && 'data' in d ? d.data : d
  ) ?? []) as StreamDataPayload[];
  const statusText = payloads
    .filter((p) => typeof p.status === 'string')
    .at(-1)?.status;
  const insights = payloads
    .filter((p) => Array.isArray(p.insights))
    .flatMap((p) => p.insights || []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-border shadow-2xl relative overflow-hidden">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#09090b]/80 backdrop-blur-xl z-20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-4 h-4 text-white fill-current" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white leading-none">
              Skill Architect
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                Interlink Engine
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && (
            <button
              onClick={handleAutoAnalyze}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-indigo-400 group"
              title="Deep Analysis"
            >
              <Activity className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth scrollbar-hide bg-[#09090b]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-700">
            <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/5 grid place-items-center mb-6 border border-indigo-500/10 rotate-12">
              <Bot className="w-10 h-10 text-indigo-500 -rotate-12" />
            </div>
            <div className="max-w-[240px] space-y-3">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Analytical Feedback
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                I can help you build, format, and validate your skill. Click{' '}
                <strong className="text-indigo-400">Analyze</strong> or ask me a
                question.
              </p>
              <button
                onClick={handleAutoAnalyze}
                disabled={isLoading}
                className="mx-auto mt-6 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 group"
              >
                <Activity className="w-4 h-4 group-hover:animate-pulse" />
                Analyze Content
              </button>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const parts = (message.parts ?? []) as MessagePart[];
            const isUser = message.role === 'user';

            // Extract content by type
            const textContent = parts
              .filter(isTextPart)
              .map((p) => p.text)
              .join('\n\n');

            const reasoningContent = parts
              .filter(isReasoningPart)
              .map((p) => p.text)
              .join('\n\n');

            const toolCalls = parts.filter(isToolCallPart);
            const toolResults = parts.filter(isToolResultPart);

            const hasText = textContent.trim().length > 0;
            const hasReasoning = reasoningContent.trim().length > 0;
            const hasTools = toolCalls.length > 0 || toolResults.length > 0;

            // Skip completely empty assistant messages
            if (
              message.role === 'assistant' &&
              !hasText &&
              !hasReasoning &&
              !hasTools &&
              !isLoading
            ) {
              return null;
            }

            return (
              <div key={message.id}>
                {isUser ? (
                  <div className="flex w-full justify-end animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-br-none px-4 py-3 shadow-md text-sm leading-relaxed">
                      {textContent}
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full justify-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="mt-1 shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-4">
                      {/* Internal Reasoning */}
                      {hasReasoning && (
                        <div className="text-xs italic text-zinc-400 border-l-2 border-indigo-500/30 pl-3 py-1 bg-indigo-500/5 rounded-r-md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {reasoningContent}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Tool Executions */}
                      {hasTools && (
                        <div className="flex flex-col gap-2">
                          {parts.map((p, idx) => {
                            if (isToolCallPart(p)) {
                              return (
                                <div
                                  key={`${message.id}-call-${idx}`}
                                  className="flex items-center gap-3 px-3 py-2 bg-black/30 rounded-xl border border-white/5 text-[11px] font-medium text-zinc-400"
                                >
                                  <div className="p-1 rounded-md bg-zinc-800/50">
                                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                  </div>
                                  <span className="flex-1">
                                    Executing{' '}
                                    <span className="text-zinc-200">
                                      {p.toolName}
                                    </span>
                                  </span>
                                  <div className="flex gap-1">
                                    <span
                                      className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"
                                      style={{ animationDelay: '0ms' }}
                                    />
                                    <span
                                      className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"
                                      style={{ animationDelay: '200ms' }}
                                    />
                                    <span
                                      className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"
                                      style={{ animationDelay: '400ms' }}
                                    />
                                  </div>
                                </div>
                              );
                            }
                            if (isToolResultPart(p)) {
                              return (
                                <ToolResultBlock
                                  key={`${message.id}-res-${idx}`}
                                  part={p}
                                  onApplyFix={(c) =>
                                    handleApplyFix(c, 'Updated skill template.')
                                  }
                                />
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}

                      {/* Main Text Response */}
                      {hasText && (
                        <div className="prose prose-sm prose-invert max-w-none text-zinc-200 leading-relaxed text-[13.5px]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {textContent}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Fallback Loader */}
                      {!hasText &&
                        toolCalls.length > 0 &&
                        isLoading &&
                        !statusText && (
                          <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse italic">
                            <Activity className="w-3.5 h-3.5" />
                            Analyzing results and preparing response...
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Neural Research Matrix */}
        {isLoading && (
          <div className="space-y-4 pt-2 border-t border-zinc-800/40 mt-6 min-h-[100px] animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                <Layers className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                Neural Research Matrix
              </div>
              {statusText && (
                <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                  <span className="text-[9px] font-bold text-indigo-400">
                    LIVE STREAM
                  </span>
                </div>
              )}
            </div>

            {statusText && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800/50 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                  <BrainCircuit className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                    <div className="text-xs font-semibold text-zinc-100 italic tracking-tight uppercase">
                      &quot;{statusText}&quot;
                    </div>
                  </div>
                  {insights.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 pl-3 border-l border-zinc-800/80">
                      {insights.map((insight, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-[11px] text-zinc-400 group/item"
                        >
                          <span className="text-indigo-500 opacity-50 font-mono">
                            0{(i + 1) % 10}
                          </span>
                          <span className="group-hover/item:text-zinc-200 transition-colors">
                            {insight}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent animate-matrix-scan" />
              </div>
            )}

            {!statusText && messages.at(-1)?.role !== 'assistant' && (
              <StreamingIndicator />
            )}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center space-x-3 text-red-400">
            <XCircle className="w-5 h-5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold uppercase tracking-tight mb-0.5">
                Runtime Error
              </p>
              <p className="opacity-80">
                {error.message ||
                  'An unexpected error occurred during the session.'}
              </p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-[#09090b] z-20">
        <form onSubmit={handleSubmit} className="relative group">
          <textarea
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-4 pr-12 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all resize-none overflow-hidden min-h-[44px] max-h-[200px]"
            rows={1}
            value={input}
            placeholder="Ask for architectural guidance..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input?.trim() || isLoading}
            className="absolute right-2 top-2 p-1.5 rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 disabled:grayscale transition-all shadow-md active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="mt-2 text-[9px] text-center text-zinc-600 font-bold tracking-widest uppercase">
          Enforcing G-Stack &amp; MinimumCD Standards
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolResultBlock
// ---------------------------------------------------------------------------

function ToolResultBlock({
  part,
  onApplyFix,
}: {
  part: ToolResultPart;
  onApplyFix: (c: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const output = part.result as Record<string, unknown> | null;

  const hasApplyableContent =
    part.toolName === 'update_skill_template' &&
    output != null &&
    (typeof output.content === 'string' ||
      typeof output.newContent === 'string');

  const hasFormattedContent =
    (part.toolName === 'update_skill_template' ||
      part.toolName === 'lint_and_format') &&
    output != null &&
    typeof output.formattedContent === 'string';

  const displayOutput = output
    ? typeof output.output === 'string'
      ? output.output
      : typeof output.message === 'string'
        ? output.message
        : typeof output.error === 'string'
          ? output.error
          : null
    : null;

  const isError =
    output?.success === false || output?.error || output?.errorText;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          <div
            className={cn(
              'p-1 rounded',
              isError
                ? 'bg-red-500/10 text-red-500'
                : 'bg-emerald-500/10 text-emerald-500'
            )}
          >
            {isError ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
          </div>
          <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-tight">
            {part.toolName}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={cn(
              'text-[9px] font-bold uppercase tracking-widest',
              isError ? 'text-red-500' : 'text-emerald-500'
            )}
          >
            {isError ? 'Failed' : 'Done'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-800/50 animate-in slide-in-from-top-1 duration-200">
          {(hasFormattedContent || hasApplyableContent) && output && (
            <div className="space-y-3 mb-2">
              <p className="text-[10px] text-zinc-500 font-medium italic">
                Refinement proposed by Skill Architect.
              </p>
              <button
                onClick={() =>
                  onApplyFix(
                    (hasFormattedContent
                      ? output.formattedContent
                      : (output.content ?? output.newContent)) as string
                  )
                }
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Apply Corrections</span>
              </button>
            </div>
          )}

          {displayOutput && (
            <div className="bg-[#09090b] rounded-lg border border-zinc-800/50 p-2 mt-2">
              <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-tight max-h-40 overflow-y-auto">
                {displayOutput}
              </pre>
            </div>
          )}

          {!displayOutput &&
            !hasApplyableContent &&
            !hasFormattedContent &&
            output && (
              <div className="bg-[#09090b] rounded-lg border border-zinc-800/50 p-2 mt-2">
                <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-tight max-h-40 overflow-y-auto">
                  {JSON.stringify(output, null, 2)}
                </pre>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
