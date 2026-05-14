'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FullscreenGuideViewerProps {
  title: string;
  content: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * @desc A premium, fullscreen markdown document viewer.
 * Provides a focused reading experience for technical guides and E2E manuals.
 */
export function FullscreenGuideViewer({
  title,
  content,
  isOpen,
  onClose,
}: FullscreenGuideViewerProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 animate-in fade-in duration-300">
      {/* Header */}
      <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close guide</span>
        </Button>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-24 pl-8 md:pl-20">
          <article className="prose prose-invert prose-zinc max-w-none 
            prose-headings:font-bold prose-headings:text-zinc-100 prose-headings:tracking-tight
            prose-h1:text-4xl prose-h1:mb-12 prose-h1:text-white
            prose-h2:text-2xl prose-h2:mt-20 prose-h2:mb-8 prose-h2:text-violet-400 prose-h2:border-b prose-h2:border-zinc-800 prose-h2:pb-4
            prose-h3:text-lg prose-h3:mt-12 prose-h3:mb-4 prose-h3:text-zinc-200
            prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:mb-6
            prose-strong:text-violet-300 prose-strong:font-bold
            prose-hr:my-20 prose-hr:border-zinc-800
            prose-code:text-emerald-400 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
            prose-a:text-violet-400 hover:prose-a:text-violet-300 prose-a:transition-colors
            prose-li:text-zinc-300 prose-li:mb-2
            prose-table:w-full prose-table:my-10 prose-table:border-collapse
            prose-th:bg-zinc-900/50 prose-th:text-zinc-100 prose-th:font-bold prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:text-xs prose-th:uppercase prose-th:tracking-wider prose-th:border prose-th:border-zinc-800
            prose-td:px-4 prose-td:py-3 prose-td:border prose-td:border-zinc-800 prose-td:text-sm prose-td:text-zinc-300
            prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-pre:shadow-2xl prose-pre:rounded-xl">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold mt-20 mb-8 text-violet-400 border-b border-zinc-800 pb-4 tracking-tight">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-bold mt-12 mb-4 text-zinc-100">
                    {children}
                  </h3>
                ),
                hr: () => <hr className="my-24 border-zinc-800" />,
                table: ({ children }) => (
                  <div className="my-12 overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-900/20 shadow-2xl">
                    <table className="w-full border-collapse text-left">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-zinc-900/80 border-b border-zinc-800">
                    {children}
                  </thead>
                ),
                th: ({ children }) => (
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-400 border-r border-zinc-800 last:border-r-0">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-6 py-4 text-sm text-zinc-300 border-r border-zinc-800 last:border-r-0 align-top">
                    {children}
                  </td>
                ),
                tr: ({ children }) => (
                  <tr className="border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-800/20 transition-colors">
                    {children}
                  </tr>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
      </main>
    </div>
  );
}
