'use client';

import ChatBody from '@/components/chat/ChatBody';
import { ReviewSessionPanel } from '@/components/design-review/ReviewSessionPanel';
import { GateResult, ReviewSession, ReviewStatus } from '@/lib/design-review-types';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DesignReviewSessionProps {
  sessionId: string;
}

/**
 * @desc Client-side session view for /design-review/[sessionId].
 * Fetches session data, renders the split-panel layout (ReviewSessionPanel +
 * ChatBody), and handles PATCH calls for iteration advancement and status changes.
 */
export function DesignReviewSession({ sessionId }: DesignReviewSessionProps) {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [chatId, setChatId] = useState<string | null>(sessionId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch session ────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    try {
      // We re-use the existing /api/chat GET (by chatId) for the base chat data
      // and /api/design-review PATCH for metadata updates. To read the current
      // session, we call GET /api/design-review?projectId and find by id.
      // Simpler: hit a direct lookup via chat endpoint — the metadata is on Chat.
      const res = await fetch(`/api/design-review/session/${sessionId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to load session');
      }
      const data = (await res.json()) as { session: ReviewSession };
      setSession(data.session);
      setChatId(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // ── PATCH helper ──────────────────────────────────────────────────────────────

  const patchSession = useCallback(
    async (updates: {
      gateResults?: GateResult[];
      alignmentScore?: number;
      iteration?: 1 | 2;
      status?: ReviewStatus;
    }) => {
      const res = await fetch('/api/design-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...updates }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Update failed');
      }
      const data = (await res.json()) as { session: ReviewSession };
      setSession(data.session);
    },
    [sessionId]
  );

  // ── Action handlers ───────────────────────────────────────────────────────────

  const handleAdvanceIteration = useCallback(async () => {
    await patchSession({ iteration: 2 });
  }, [patchSession]);

  const handleMarkReady = useCallback(async () => {
    await patchSession({ status: 'READY_FOR_DESIGNER_GATE' });
  }, [patchSession]);

  const handleEscalate = useCallback(async () => {
    await patchSession({ status: 'ESCALATED' });
  }, [patchSession]);

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-center p-8">
        <div className="space-y-2">
          <p className="text-red-400 font-semibold">Failed to load session</p>
          <p className="text-zinc-500 text-sm">{error ?? 'Session not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Left: session state panel */}
      <ReviewSessionPanel
        session={session}
        onAdvanceIteration={handleAdvanceIteration}
        onMarkReady={handleMarkReady}
        onEscalate={handleEscalate}
      />

      {/* Right: existing chat panel — chatId IS the sessionId */}
      <main className="flex-1 flex flex-col min-w-0 border-l border-zinc-800">
        <ChatBody
          projectId={session.projectId}
          chatId={chatId}
          setChatId={setChatId}
          onChatCreated={() => {}} // session already exists — no sidebar to refresh
        />
      </main>
    </div>
  );
}
