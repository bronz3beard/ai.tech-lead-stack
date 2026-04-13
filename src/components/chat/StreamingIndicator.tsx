import { Bot, Sparkles } from 'lucide-react';

export default function StreamingIndicator() {
  return (
    <div className="flex w-full justify-start items-end gap-2 group">
      <div className="shrink-0 mb-1">
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/20">
          <Bot className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="max-w-[85%] rounded-2xl rounded-bl-none px-5 py-4 bg-zinc-900/40 backdrop-blur-xl text-zinc-200 shadow-2xl border border-white/5 flex flex-col gap-2 relative overflow-hidden group">
        {/* Animated gradient background sweep */}
        <div className="absolute inset-0 bg-linear-to-br from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform pointer-events-none" />

        <div className="flex items-center gap-3">
          <div className="flex space-x-1.5 items-center">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-[bounce_1s_infinite_400ms]"></div>
          </div>
          <span className="text-sm font-semibold bg-linear-to-br from-zinc-200 to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
            Synthesizing Intelligence
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          </span>
        </div>

        <div className="h-1 w-full bg-zinc-800/50 rounded-full overflow-hidden">
          <div className="h-full bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 w-1/3 animate-[progress_2s_ease-in-out_infinite] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
