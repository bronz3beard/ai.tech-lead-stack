'use client';

import { Card, CardTitle } from '@/components/ui/card';
import { Book, ChevronDown, ChevronUp, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { FullscreenGuideViewer } from './FullscreenGuideViewer';

/**
 * @desc Launcher for technical guides. Displays a list of available documentation
 * and opens them in a fullscreen modal for better readability.
 */
export function HowToGuidePanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedGuide, setSelectedGuide] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const guides = [
    {
      id: 'e2e-testing',
      title: 'End-to-End Manual Testing & QA Guide',
      description:
        'Step-by-step instructions for verifying the AI review workflow.',
      icon: FileText,
      api: '/api/design-review/testing-guide',
    },
  ];

  const handleOpenGuide = async (guide: (typeof guides)[0]) => {
    setLoadingId(guide.id);
    try {
      const res = await fetch(guide.api);
      if (res.ok) {
        const data = await res.json();
        setSelectedGuide({ title: guide.title, content: data.content });
        setIsViewerOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch guide:', err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <Card className="bg-zinc-900/40 border-zinc-800 mt-4 overflow-hidden">
        <button
          className="w-full px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/20 transition-colors text-left"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Book className="h-3 w-3" />
              How-To Guides
            </div>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-zinc-600" />
            ) : (
              <ChevronDown className="h-3 w-3 text-zinc-600" />
            )}
          </CardTitle>
        </button>

        {isExpanded && (
          <div className="p-2 space-y-1 bg-zinc-950/20">
            {guides.map((guide) => (
              <button
                key={guide.id}
                onClick={() => handleOpenGuide(guide)}
                disabled={loadingId !== null}
                className="w-full text-left p-3 rounded-lg hover:bg-zinc-800/60 transition-all group flex items-start gap-3 disabled:opacity-50"
              >
                <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 group-hover:border-violet-500/50 group-hover:bg-violet-500/5 transition-all shrink-0">
                  {loadingId === guide.id ? (
                    <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                  ) : (
                    <guide.icon className="h-4 w-4 text-zinc-400 group-hover:text-violet-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                    {guide.title}
                  </p>
                  <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                    {guide.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedGuide && (
        <FullscreenGuideViewer
          title={selectedGuide.title}
          content={selectedGuide.content}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </>
  );
}
