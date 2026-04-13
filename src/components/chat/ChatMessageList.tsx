import { UIMessage } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import StreamingIndicator from './StreamingIndicator';
import { Bot, Terminal } from 'lucide-react';

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
    ?.filter((d: any) => d && typeof d === 'object' && 'status' in d)
    .pop()?.status as string | undefined;

  return (
    <div className="space-y-6 pb-4">
      {messages.map((message) => {
        // Collect text content from parts
        const textContent = message.parts
          .filter((part) => part.type === 'text' || part.type === 'reasoning')
          .map((part: any) => part.text)
          .join('\n\n');

        // Check if message has tool calls
        const toolCalls = message.parts.filter((part) => part.type === 'tool-call');

        // Use standard text content, or a tool call indicator if text is empty
        const displayContent = textContent || (toolCalls.length > 0 ? '' : null);

        if (displayContent === null && toolCalls.length === 0) return null;

        return (
          <div
            key={message.id}
            className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-md rounded-br-none'
                  : 'bg-zinc-800/80 text-zinc-200 shadow-sm border border-zinc-700 rounded-bl-none'
              }`}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap text-sm">{textContent}</div>
              ) : (
                <div className="space-y-4">
                  {/* Tool Call Indicators */}
                  {toolCalls.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {toolCalls.map((part: any) => (
                        <div 
                          key={part.toolCallId}
                          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-700/50 text-xs text-zinc-400"
                        >
                          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Running <b>{part.toolName}</b>...</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Content */}
                  {textContent ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{textContent}</ReactMarkdown>
                    </div>
                  ) : (
                    toolCalls.length > 0 && isLoading && (
                      <div className="flex items-center gap-2 text-sm text-zinc-400 animate-pulse italic">
                        Processing tools...
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
        <div className="space-y-4">
          {currentStatus && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className="mt-1">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                </div>
                <div>
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">System Status</div>
                  <div className="text-sm text-zinc-300 font-medium leading-relaxed">
                    {currentStatus}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {messages[messages.length - 1]?.role !== 'assistant' && !currentStatus && (
            <StreamingIndicator />
          )}
        </div>
      )}
    </div>
  );
}
