import { UIMessage } from '@ai-sdk/react';
import {
  Activity,
  Book,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Layers,
  Search,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import MermaidRenderer from './MermaidRenderer';
import StreamingIndicator from './StreamingIndicator';

// ---------------------------------------------------------------------------
// Stream data types — mirrors the server-side event shapes
// ---------------------------------------------------------------------------

/** Payload fields emitted by the server in a stream data event */
interface StreamDataPayload {
  insights?: string[];
  status?: string;
  error?: string;
}

/**
 * Stream data items may arrive either bare `StreamDataPayload`
 * or wrapped in a `{ data: StreamDataPayload }` envelope.
 */
type StreamDataItem = StreamDataPayload | { data: StreamDataPayload };

/** Normalise both envelope shapes to a flat payload. */
function getStreamPayload(item: StreamDataItem): StreamDataPayload {
  return 'data' in item ? item.data : item;
}

// ---------------------------------------------------------------------------
// Message part types — matches the subset used in this component
// ---------------------------------------------------------------------------

/** SDK TextUIPart — `{ type: 'text'; text: string }` */
interface TextPart {
  type: 'text';
  text: string;
}

/**
 * SDK ReasoningUIPart — `{ type: 'reasoning'; text: string }`.
 * The code historically read `part.reasoning` as an alias; we map it via
 * `part.text` which is what the SDK actually provides.
 */
interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

/** Represents a tool call issued by the model (type: 'tool-call' internally) */
interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/** Represents a completed tool result (type: 'tool-result' internally) */
interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
}

/** Catch-all for any other parts the SDK may add (step-start, file, etc.) */
interface UnknownPart {
  type: string;
}

type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolCallPart
  | ToolResultPart
  | UnknownPart;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isToolCallPart(part: MessagePart): part is ToolCallPart {
  return part.type === 'tool-call';
}

function isToolResultPart(part: MessagePart): part is ToolResultPart {
  return part.type === 'tool-result';
}

// ---------------------------------------------------------------------------
// ReactMarkdown code component props
// ---------------------------------------------------------------------------

/**
 * Props for the custom `code` renderer passed to ReactMarkdown.
 * `inline` is injected by remark-based plugins; `node` is the hast element
 * (typed as `unknown` to avoid pulling in the full hast type tree).
 */
interface CodeComponentProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  node?: unknown;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ChatMessageListProps {
  messages: UIMessage[];
  /** Streaming data for custom events — presence signals an active stream */
  data?: StreamDataItem[];
  isLoading?: boolean;
}

export default function ChatMessageList({
  messages,
  data,
  isLoading,
}: ChatMessageListProps) {
  // Sentinel ref: the invisible div at the bottom of the list
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll whenever messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

  // Initial scroll to bottom for historical chats on mount
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Small delay to ensure layout is ready
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, messages.length === 0]);

  // History mode: not currently streaming AND no live stream data in flight.
  // In this mode: suppress tool-call/tool-result trails and reasoning blocks —
  // show only the clean final AI text response.
  const isHistory = !isLoading && (data?.length ?? 0) === 0;

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center text-zinc-500">
          <h3 className="text-lg font-medium text-zinc-300">
            Start a new conversation
          </h3>
          <p className="mt-2 text-sm">
            Ask a question or type &apos;/&apos; to run a workflow.
          </p>
        </div>
      </div>
    );
  }

  // Normalise all items to a flat payload once, then derive derived values
  const payloads = data?.map(getStreamPayload) ?? [];

  // Collect all insights from the data stream to show a research timeline.
  // Filter out irrelevant local filesystem errors that occur in virtual environments.
  const IRRELEVANT_PATTERNS = [
    'Encountered access error for',
    'Cataloged 0 available skills',
    'File not found (skipped)',
  ];

  const allInsights: string[] = payloads
    .filter((p): p is StreamDataPayload & { insights: string[] } =>
      Array.isArray(p.insights)
    )
    .flatMap((p) => p.insights)
    .map((insight) => {
      const isIrrelevant = IRRELEVANT_PATTERNS.some((p) => insight.includes(p));
      return isIrrelevant ? 'Thinking...' : insight;
    });

  // Get the most recent status from the data stream
  const statusText = payloads
    .filter(
      (p): p is StreamDataPayload & { status: string } =>
        typeof p.status === 'string'
    )
    .at(-1)?.status;

  const errorText = payloads
    .filter(
      (p): p is StreamDataPayload & { error: string } =>
        typeof p.error === 'string'
    )
    .at(-1)?.error;

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('skill'))
      return <Book className="w-3.5 h-3.5 text-emerald-400" />;
    if (toolName.includes('list'))
      return <Layers className="w-3.5 h-3.5 text-blue-400" />;
    if (toolName.includes('read') || toolName.includes('view'))
      return <FileText className="w-3.5 h-3.5 text-amber-400" />;
    if (toolName.includes('grep') || toolName.includes('search'))
      return <Search className="w-3.5 h-3.5 text-indigo-400" />;
    return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
  };

  return (
    <div className="space-y-8 pb-4">
      {messages.map((message) => {
        // Cast to our local union once; the SDK types don't expose
        // 'tool-call'/'tool-result' part types publicly.
        const parts = message.parts as MessagePart[];

        const reasoningContent = parts
          .filter((part): part is ReasoningPart => part.type === 'reasoning')
          .map((part) => part.text)
          .join('\n\n');

        const textContent = parts
          .filter((part): part is TextPart => part.type === 'text')
          .map((part) => part.text)
          .join('\n\n');

        const toolCalls = parts.filter(isToolCallPart);
        const toolResults = parts.filter(isToolResultPart);

        const hasContent =
          textContent.trim().length > 0 || reasoningContent.trim().length > 0;
        // In history mode we only care about text content; skip pure-tool messages entirely
        const hasTools =
          !isHistory && (toolCalls.length > 0 || toolResults.length > 0);

        // Skip messages that are pure tool intermediaries in history mode
        if (isHistory && !hasContent) return null;
        // Also skip any message with no renderable content at all
        if (!hasContent && !hasTools) return null;

        return (
          <div key={message.id}>
            {message.role === 'user' ? (
              /* ── User message: tight indigo bubble aligned right ── */
              <div className="flex w-full justify-end">
                <div className="max-w-[72%] bg-indigo-600 text-white rounded-2xl rounded-br-none px-5 py-3 shadow-lg text-[15px] leading-relaxed">
                  <div className="whitespace-pre-wrap">{textContent}</div>
                </div>
              </div>
            ) : (
              /* ── Assistant message: open document layout with icon ── */
              <div className="flex w-full justify-start gap-3">
                {/* Bot icon column */}
                <div className="mt-0.5 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                </div>

                {/* Content column */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="space-y-4">
                    {/* Reasoning / Thinking Process — hidden in history mode */}
                    {!isHistory && reasoningContent && (
                      <div className="text-xs italic text-zinc-400 border-l-2 border-indigo-500/30 pl-3 py-1 bg-indigo-500/5 rounded-r-md">
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-wider font-semibold opacity-70">
                          <Activity className="w-3 h-3 text-indigo-400" />
                          Internal Reasoning
                        </div>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {reasoningContent}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Tool Call & Result Indicators — hidden in history mode */}
                    {hasTools && (
                      <div className="flex flex-col gap-2">
                        {parts.map((part, idx) => {
                          if (isToolCallPart(part)) {
                            return (
                              <div
                                key={`${message.id}-call-${idx}`}
                                className="flex items-center gap-3 px-3 py-2 bg-black/30 rounded-xl border border-white/5 text-[11px] font-medium text-zinc-400"
                              >
                                <div className="p-1 rounded-md bg-zinc-800/50">
                                  {getToolIcon(part.toolName)}
                                </div>
                                <span className="flex-1">
                                  Executing{' '}
                                  <span className="text-zinc-200">
                                    {part.toolName}
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
                          if (isToolResultPart(part)) {
                            return (
                              <ToolResultBlock
                                key={`${message.id}-res-${idx}`}
                                part={part}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}

                    {/* Message Content */}
                    {textContent ? (
                      <div className="chat-prose">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({
                              node,
                              inline,
                              className,
                              children,
                              ...props
                            }: CodeComponentProps) {
                              const match = /language-(\w+)/.exec(
                                className ?? ''
                              );
                              const language = match ? match[1] : '';
                              const content = String(children).replace(
                                /\n$/,
                                ''
                              );

                              if (!inline && language === 'mermaid') {
                                return <MermaidRenderer chart={content} />;
                              }

                              if (!inline && match) {
                                return (
                                  <CodeBlock
                                    language={language}
                                    value={content}
                                  />
                                );
                              }

                              // Inline code — CSS handles the styling via .chat-prose code
                              return (
                                <code className={className ?? ''} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {textContent}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      toolCalls.length > 0 &&
                      isLoading &&
                      !statusText && (
                        <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse italic">
                          <Activity className="w-3.5 h-3.5" />
                          Analyzing results and preparing response...
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Show Analytical Progress / Streaming Indicator — only during live stream */}
      {isLoading && (
        <div className="space-y-4 pt-2">
          {statusText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-linear-to-r from-zinc-900 via-indigo-950/20 to-zinc-900 border border-indigo-500/20 rounded-2xl px-5 py-4 flex flex-col gap-3 shadow-lg shadow-indigo-500/5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping absolute" />
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full relative shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-1 opacity-90 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Neural Research Matrix
                      </span>
                      <span className="text-[9px] opacity-60 font-mono">
                        STEP_MODE: ACTIVE
                      </span>
                    </div>
                    <div className="text-sm text-zinc-100 font-medium leading-relaxed truncate">
                      {statusText}
                    </div>
                  </div>
                </div>

                {/* Research Insight Log */}
                {allInsights.length > 0 && (
                  <div className="ml-6.5 mt-1 border-l border-zinc-800/80 pl-4 space-y-2">
                    {allInsights.map((insight, i) => (
                      <div
                        key={`insight-${i}`}
                        className="flex items-center gap-2 text-[11px] text-zinc-400 group animate-in fade-in slide-in-from-left-2 duration-300"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40 group-last:bg-indigo-400 group-last:animate-pulse" />
                        <span className="truncate group-last:text-zinc-300 group-last:font-medium">
                          {insight}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {errorText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 flex items-start gap-4 shadow-lg backdrop-blur-sm">
                <div className="mt-1 border-2 border-red-500/30 rounded-full p-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5 opacity-80">
                    Execution Interrupt
                  </div>
                  <div className="text-sm text-red-200 font-medium leading-relaxed">
                    {errorText}
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages[messages.length - 1]?.role !== 'assistant' &&
            !statusText &&
            !errorText && <StreamingIndicator />}
        </div>
      )}

      {/* Scroll anchor — always rendered at the very bottom of the list */}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeBlock
// ---------------------------------------------------------------------------

/**
 * @desc Professional code block with syntax highlighting and copy button.
 * @param language - The language identifier for the code block
 * @param value - The raw code string to display
 */
function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div className="group relative my-6 rounded-xl overflow-hidden border border-white/10 bg-[#1e1e1e] shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
            {language}
          </span>
        </div>
        <button
          onClick={copyToClipboard}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="p-0 overflow-x-auto custom-scrollbar">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1.25rem',
            background: 'transparent',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'var(--font-mono)',
            },
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolResultBlock
// ---------------------------------------------------------------------------

/**
 * @desc Collapsible block for tool results to keep the UI clean.
 * @param part - The typed tool result part from the message
 */
function ToolResultBlock({ part }: { part: ToolResultPart }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const resultString =
    typeof part.result === 'string'
      ? part.result
      : JSON.stringify(part.result ?? null, null, 2);

  return (
    <div className="flex flex-col bg-black/20 rounded-xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-[11px] font-medium text-zinc-400"
      >
        <div className="p-1 rounded-md bg-zinc-800/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="flex-1 text-left">
          Result received for{' '}
          <span className="text-zinc-300 font-semibold">{part.toolName}</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          <div className="bg-black/50 rounded-lg p-3 border border-white/5 overflow-x-auto max-h-[300px] font-mono text-[10px] text-zinc-400 leading-relaxed custom-scrollbar">
            <pre className="whitespace-pre-wrap">{resultString}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
