'use client';

import { AlertOctagon, RotateCcw } from 'lucide-react';

/**
 * Root global error boundary for Next.js App Router.
 * Replaces the entire root layout when an unhandled error occurs at the root level,
 * ensuring the user never sees an unstyled browser crash page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full bg-[#0f172a] text-slate-200">
      <body className="h-full flex items-center justify-center p-4 font-sans bg-[#0f172a]">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center space-y-6">
          {/* Critical Error Icon with Red Glow */}
          <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.15)]">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Application Error
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              A critical server error occurred while initializing the application.
            </p>
          </div>

          {error?.digest && (
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-left font-mono text-xs text-slate-400 overflow-x-auto">
              <span className="text-slate-500 select-none">Digest: </span>
              <span>{error.digest}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
