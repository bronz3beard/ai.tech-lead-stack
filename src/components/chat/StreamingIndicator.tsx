import { Bot } from "lucide-react";

export default function StreamingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-zinc-800/80 text-zinc-200 shadow-sm border border-zinc-700 rounded-bl-none flex items-center space-x-3">
        <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
        <span className="text-sm font-medium text-zinc-300">Agent is thinking...</span>
        <div className="flex space-x-1 items-center h-full">
          <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
          <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
          <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
        </div>
      </div>
    </div>
  );
}
