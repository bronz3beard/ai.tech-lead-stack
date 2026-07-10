'use client';

import { ReviewSession, ReviewStatus } from '@/lib/design-review-types';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ReviewStatus, string> = {
  IN_PROGRESS: 'bg-violet-900/30 text-violet-300 border border-violet-700/40',
  READY_FOR_DESIGNER_GATE:
    'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40',
  ESCALATED: 'bg-amber-900/30 text-amber-300 border border-amber-700/40',
};

const STATUS_ICONS: Record<ReviewStatus, React.ReactNode> = {
  IN_PROGRESS: <Clock className="h-3 w-3" />,
  READY_FOR_DESIGNER_GATE: <CheckCircle2 className="h-3 w-3" />,
  ESCALATED: <AlertTriangle className="h-3 w-3" />,
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  IN_PROGRESS: 'In Progress',
  READY_FOR_DESIGNER_GATE: 'Ready for Gate',
  ESCALATED: 'Escalated',
};

// ─── New Session Modal ────────────────────────────────────────────────────────

interface NewSessionModalProps {
  projectId: string;
  onCreated: (sessionId: string) => void;
  onClose: () => void;
}

function NewSessionModal({
  projectId,
  onCreated,
  onClose,
}: NewSessionModalProps) {
  const [component, setComponent] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!component.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/design-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          component: component.trim(),
          figmaUrl: figmaUrl.trim() || undefined,
          prUrl: prUrl.trim() || undefined,
          initiatedBy: 'DEVELOPER', // Manual starts from dashboard are treated as Dev/Designer
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to create session');
      }

      const data = (await res.json()) as { session: ReviewSession };
      onCreated(data.session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-session-modal-title"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-900/30 border border-violet-700/40">
            <Palette className="h-5 w-5 text-violet-400" />
          </div>
          <h2
            id="new-session-modal-title"
            className="text-lg font-bold text-zinc-100"
          >
            New Design Review
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="dr-component-input"
              className="block text-xs font-semibold text-zinc-400 mb-1.5"
            >
              Component Name <span className="text-red-400">*</span>
            </label>
            <input
              id="dr-component-input"
              type="text"
              required
              placeholder="e.g. Button, DatePicker, Navbar"
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label
              htmlFor="dr-figma-url-input"
              className="block text-xs font-semibold text-zinc-400 mb-1.5"
            >
              Figma Frame URL{' '}
              <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <input
              id="dr-figma-url-input"
              type="url"
              placeholder="https://www.figma.com/file/..."
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label
              htmlFor="dr-pr-url-input"
              className="block text-xs font-semibold text-zinc-400 mb-1.5"
            >
              GitHub PR URL
              <span className="text-zinc-600 font-normal ml-0.5">
                (optional)
              </span>
            </label>
            <input
              id="dr-pr-url-input"
              type="url"
              placeholder="https://github.com/org/repo/pull/..."
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="dr-create-session-btn"
              type="submit"
              disabled={isSubmitting || !component.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Start Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onDelete,
  onRestore,
}: {
  session: ReviewSession;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
}) {
  const router = useRouter();
  const passCount = session.gateResults.filter(
    (g) => g.status === 'pass'
  ).length;
  const isDeleted = !!session.deletedAt;

  return (
    <div className="group relative">
      <button
        onClick={() => router.push(`/design-review/${session.id}`)}
        disabled={isDeleted}
        className={`w-full text-left p-4 bg-zinc-900 border rounded-xl transition-all space-y-3 ${
          isDeleted
            ? 'opacity-50 grayscale border-zinc-800'
            : 'hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
              {session.component}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5" suppressHydrationWarning>
              Updated {new Date(session.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[session.status]}`}
          >
            {STATUS_ICONS[session.status]}
            {STATUS_LABELS[session.status]}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Iteration {session.iteration}/2</span>
          <span>{passCount}/5 gates</span>
          {session.alignmentScore !== undefined && (
            <span
              className={
                session.alignmentScore >= 90
                  ? 'text-emerald-400'
                  : session.alignmentScore >= 70
                    ? 'text-amber-400'
                    : 'text-red-400'
              }
            >
              {session.alignmentScore}% aligned
            </span>
          )}
          {session.figmaUrl && (
            <a
              href={session.figmaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
            >
              <ExternalLink className="h-3 w-3" />
              Figma
            </a>
          )}
          {session.prUrl && (
            <a
              href={session.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
            >
              <ExternalLink className="h-3 w-3" />
              Pull Request
            </a>
          )}
        </div>
      </button>

      {!isDeleted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(session.id);
          }}
          className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-900/20 border border-transparent hover:border-red-800/30"
          title="Delete review"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {isDeleted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestore?.(session.id);
          }}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-emerald-400 transition-all rounded-lg hover:bg-emerald-900/20 border border-emerald-800/30 flex items-center gap-2 text-xs font-semibold"
        >
          <RotateCcw className="h-4 w-4" />
          Restore
        </button>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="p-4 rounded-2xl bg-violet-900/20 border border-violet-800/30">
        <Palette className="h-10 w-10 text-violet-400" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-zinc-200">No Reviews Yet</h3>
        <p className="text-sm text-zinc-500 mt-1 max-w-xs">
          Start a new design review to audit component alignment against your
          design system.
        </p>
      </div>
      <button
        id="dr-empty-new-review-btn"
        onClick={onNew}
        className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
      >
        <Plus className="h-4 w-4" />
        Start First Review
      </button>
    </div>
  );
}

// ─── ReviewQueue ──────────────────────────────────────────────────────────────

interface ReviewQueueProps {
  sessions: ReviewSession[];
  projectId: string;
  projectName: string;
}

/**
 * @desc Dashboard component for /design-review. Shows the full review queue
 * for a project with status badges, gate progress, and alignment scores.
 * Provides "New Review" entry point via a modal.
 */
export function ReviewQueue({
  sessions,
  projectId,
  projectName,
}: ReviewQueueProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const handleSessionCreated = (sessionId: string) => {
    setIsModalOpen(false);
    router.push(`/design-review/${sessionId}`);
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    setIsProcessing(sessionId);
    try {
      const res = await fetch(`/api/design-review?sessionId=${sessionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRestore = async (sessionId: string) => {
    setIsProcessing(sessionId);
    try {
      const res = await fetch('/api/design-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          deletedAt: null,
        }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Restore error:', err);
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (showDeleted) return !!s.deletedAt;
    return !s.deletedAt;
  });

  const inProgress = filteredSessions.filter((s) => s.status === 'IN_PROGRESS');
  const completed = filteredSessions.filter((s) => s.status !== 'IN_PROGRESS');
  const deleted = sessions.filter((s) => !!s.deletedAt);

  return (
    <div className="flex flex-col min-h-full bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-white">
              Design Reviews
            </h1>
            <p className="text-zinc-400 mt-1 text-sm">
              {projectName} · {sessions.length} session
              {sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {deleted.length > 0 && (
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  showDeleted
                    ? 'bg-violet-900/30 text-violet-300 border-violet-700/40'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <Archive className="h-3.5 w-3.5" />
                {showDeleted
                  ? 'Showing Archived'
                  : `View Archive (${deleted.length})`}
              </button>
            )}
            <button
              id="dr-new-review-btn"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Review
            </button>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-20 text-center">
            {showDeleted ? (
              <p className="text-zinc-500 text-sm">Archive is empty.</p>
            ) : (
              <EmptyState onNew={() => setIsModalOpen(true)} />
            )}
          </div>
        ) : (
          <>
            {inProgress.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                  {showDeleted ? 'Archived In Progress' : 'Active'}
                </h2>
                <div className="space-y-3">
                  {inProgress.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                    />
                  ))}
                </div>
              </section>
            )}
            {completed.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                  {showDeleted ? 'Archived Completed' : 'Completed'}
                </h2>
                <div className="space-y-3">
                  {completed.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <NewSessionModal
          projectId={projectId}
          onCreated={handleSessionCreated}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
