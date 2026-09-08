'use client';

import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Route-level error boundary for the dashboard.
 * Catches runtime errors occurring inside route segments without discarding
 * the root layout (Navbar stays visible and functional).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console or telemetry provider
    console.error('[DashboardError] Caught runtime error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-12 text-slate-200">
      <div className="max-w-md w-full bg-slate-900/70 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center space-y-6">
        {/* Warning Icon with Glow */}
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Dashboard Unavailable
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            We encountered a problem loading telemetry metrics. The service may be
            temporarily connecting or recovering from high load.
          </p>
        </div>

        {/* Error Digest (if available) */}
        {error.digest && (
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-left font-mono text-xs text-slate-400 overflow-x-auto">
            <span className="text-slate-500 select-none">Error Digest: </span>
            <span>{error.digest}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
