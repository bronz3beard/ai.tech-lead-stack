'use client';

import { GithubIcon as Github } from '@/components/GithubIcon';

export function DashboardDisclaimer() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-4 px-6 mt-8 border-t border-slate-800/50 bg-slate-900/30 backdrop-blur-sm rounded-xl text-slate-400 text-sm">
      <span className="opacity-70">Data from the TLS Postgres store</span>

      <div className="w-1 h-1 rounded-full bg-slate-700 hidden sm:block" />

      <div className="flex items-center gap-2">
        <span className="opacity-70">recorded by locally installed</span>
        <a
          href="https://github.com/bronz3beard/ai.tech-lead-stack"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          <Github className="w-4 h-4" />
          <span>MCP server skills</span>
        </a>
      </div>
    </div>
  );
}
