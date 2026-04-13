import { UIMessage } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import StreamingIndicator from './StreamingIndicator';
import { 
  Bot, 
  Terminal, 
  Book, 
  Layers, 
  Activity, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Search,
  FileText
} from 'lucide-react';
import { useState } from 'react';

interface ChatMessageListProps {
  messages: UIMessage[];
  data?: any[]; // Streaming data for custom events
  isLoading?: boolean;
}

export default function ChatMessageList({
  messages,
  data,
  isLoading,
}: ChatMessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center text-zinc-500">
          <h3 className="text-lg font-medium text-zinc-300">
            Start a new conversation
          </h3>
          <p className="mt-2 text-sm">
            Ask a question or type '/' to run a workflow.
          </p>
        </div>
      </div>
    );
  }

  // Get the most recent status from the data stream
  const currentStatus = data
    ?.filter((d: any) => 
      (d && typeof d === 'object' && 'status' in d) || 
      (d?.data && typeof d.data === 'object' && 'status' in d.data)
    )
    .pop();
  
  const statusText = currentStatus?.status || currentStatus?.data?.status;

  const streamError = data
    ?.filter((d: any) => 
      (d && typeof d === 'object' && 'error' in d) ||
      (d?.data && typeof d.data === 'object' && 'error' in d.data)
    )
    .pop();
  
  const errorText = streamError?.error || streamError?.data?.error;

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('skill')) return <Book className="w-3.5 h-3.5 text-emerald-400" />;
    if (toolName.includes('list')) return <Layers className="w-3.5 h-3.5 text-blue-400" />;
    if (toolName.includes('read') || toolName.includes('view')) return <FileText className="w-3.5 h-3.5 text-amber-400" />;
    if (toolName.includes('grep') || toolName.includes('search')) return <Search className="w-3.5 h-3.5 text-indigo-400" />;
    return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
  };

  return (
    <div className="space-y-6 pb-4">
      {messages.map((message) => {
        // Collect text content from parts
        const textContent = message.parts
          .filter((part) => part.type === 'text' || part.type === 'reasoning')
          .map((part: any) => part.text)
          .join('\n\n');

        // Check if message has tool calls or results
        const toolCalls = message.parts.filter((part) => part.type === 'tool-call');
        const toolResults = message.parts.filter((part) => part.type === 'tool-result');

        // Always render if there's any content or tool activity
        const hasContent = textContent.trim().length > 0;
        const hasTools = toolCalls.length > 0 || toolResults.length > 0;

        if (!hasContent && !hasTools) return null;

        return (
          <div
            key={message.id}
            className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-lg rounded-br-none'
                  : 'bg-zinc-900/90 text-zinc-200 shadow-xl border border-zinc-800/50 backdrop-blur-md rounded-bl-none'
              }`}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{textContent}</div>
              ) : (
                <div className="space-y-5">
                  {/* Tool Call & Result Indicators */}
                  {hasTools && (
                    <div className="flex flex-col gap-2.5">
                      {message.parts.map((part: any, idx) => {
                        if (part.type === 'tool-call') {
                          return (
                            <div 
                              key={`${message.id}-call-${idx}`}
                              className="flex items-center gap-3 px-3 py-2 bg-black/40 rounded-xl border border-white/5 text-[11px] font-medium text-zinc-400"
                            >
                              <div className="p-1 rounded-md bg-zinc-800/50">
                                {getToolIcon(part.toolName)}
                              </div>
                              <span className="flex-1">Executing <span className="text-zinc-200">{part.toolName}</span></span>
                              <div className="flex gap-1">
                                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                              </div>
                            </div>
                          );
                        }
                        if (part.type === 'tool-result') {
                          return (
                            <ToolResultBlock key={`${message.id}-res-${idx}`} part={part} />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Message Content */}
                  {textContent ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5 prose-code:text-indigo-300">
                      <ReactMarkdown>{textContent}</ReactMarkdown>
                    </div>
                  ) : (
                    toolCalls.length > 0 && isLoading && !statusText && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse italic">
                        <Activity className="w-3.5 h-3.5" />
                        Analyzing results and preparing response...
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Show Analytical Progress / Streaming Indicator */}
      {isLoading && (
        <div className="space-y-4 pt-2">
          {statusText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-start gap-4 shadow-lg backdrop-blur-sm">
                <div className="mt-1">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping absolute" />
                    <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full relative shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.1em] mb-1.5 opacity-80 flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                    Neural Processing
                  </div>
                  <div className="text-sm text-zinc-100 font-medium leading-relaxed">
                    {statusText}
                  </div>
                </div>
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
                  <div className="text-[10px] font-bold text-red-400 uppercase tracking-[0.1em] mb-1.5 opacity-80">Execution Interrupt</div>
                  <div className="text-sm text-red-200 font-medium leading-relaxed">
                    {errorText}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {messages[messages.length - 1]?.role !== 'assistant' && !statusText && !errorText && (
            <StreamingIndicator />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible block for tool results to keep the UI clean.
 */
function ToolResultBlock({ part }: { part: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const resultString = typeof part.result === 'string' 
    ? part.result 
    : JSON.stringify(part.result, null, 2);

  return (
    <div className="flex flex-col bg-black/20 rounded-xl border border-white/5 overflow-hidden">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-[11px] font-medium text-zinc-400"
      >
        <div className="p-1 rounded-md bg-zinc-800/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="flex-1 text-left">Result received for <span className="text-zinc-300 font-semibold">{part.toolName}</span></span>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
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
