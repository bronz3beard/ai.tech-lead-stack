import { Message } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";

interface ChatMessageListProps {
  messages: Message[];
}

export default function ChatMessageList({ messages }: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
         <div className="text-center text-zinc-500">
            <h3 className="text-lg font-medium text-zinc-300">Start a new conversation</h3>
            <p className="mt-2 text-sm">Ask a question or type '/' to run a workflow.</p>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-5 py-4 ${
              message.role === "user"
                ? "bg-indigo-600 text-white shadow-md rounded-br-none"
                : "bg-zinc-800/80 text-zinc-200 shadow-sm border border-zinc-700 rounded-bl-none"
            }`}
          >
            {message.role === "user" ? (
               <div className="whitespace-pre-wrap text-sm">{message.content}</div>
            ) : (
               <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
               </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
