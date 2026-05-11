'use client';

import {
  GATE_LABELS,
  GateId,
  GateResult,
  GateStatus,
  ReviewSession,
  ReviewStatus,
} from '@/lib/design-review-types';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { DesignResourcePanel } from './DesignResourcePanel';

// ─── Gate Status Icon ─────────────────────────────────────────────────────────

function GateStatusIcon({ status }: { status: GateStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    case 'pending':
      return <Circle className="h-4 w-4 text-zinc-600 shrink-0" />;
    case 'skipped':
      return <Circle className="h-4 w-4 text-zinc-700 shrink-0" />;
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ReviewStatus, string> = {
  IN_PROGRESS: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  READY_FOR_DESIGNER_GATE: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  ESCALATED: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  IN_PROGRESS: 'In Progress',
  READY_FOR_DESIGNER_GATE: 'Ready for Gate',
  ESCALATED: 'Escalated',
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Gate List ────────────────────────────────────────────────────────────────

const ALL_GATE_IDS: GateId[] = [
  'token-alignment',
  'shadcn-primitive',
  'logic-consistency',
  'storybook-figma',
  'chromatic',
];

function GateList({ gateResults }: { gateResults: GateResult[] }) {
  const [expandedGate, setExpandedGate] = useState<GateId | null>(null);

  const resultsMap = new Map(gateResults.map((g) => [g.id, g]));

  return (
    <ul className="space-y-1">
      {ALL_GATE_IDS.map((id) => {
        const result = resultsMap.get(id);
        const status: GateStatus = result?.status ?? 'pending';
        const isExpanded = expandedGate === id;

        return (
          <li key={id}>
            <button
              onClick={() => setExpandedGate(isExpanded ? null : id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/60 transition-colors text-left"
              aria-expanded={isExpanded}
            >
              <GateStatusIcon status={status} />
              <span className="text-xs text-zinc-300 flex-1 truncate">
                {GATE_LABELS[id]}
              </span>
              {result?.notes && (
                <ChevronRight
                  className={`h-3 w-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              )}
            </button>
            {isExpanded && result?.notes && (
              <p className="ml-7 px-2 pb-1.5 text-[10px] text-zinc-500 leading-relaxed">
                {result.notes}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface ReviewSessionPanelProps {
  session: ReviewSession;
  /**
   * @desc Called when the user clicks "Continue to Iteration 2".
   * Parent should call PATCH /api/design-review and update local state.
   */
  onAdvanceIteration: () => Promise<void>;
  /**
   * @desc Called when the user clicks "Escalate to Design Debt".
   * Parent should call PATCH /api/design-review with status=ESCALATED.
   */
  onEscalate: () => Promise<void>;
  /**
   * @desc Called when the user clicks "Ready for Designer Gate".
   * Parent should call PATCH /api/design-review with status=READY_FOR_DESIGNER_GATE.
   */
  onMarkReady: () => Promise<void>;
}

/**
 * @desc Left-panel component for the /design-review/[sessionId] page.
 * Displays live session state: component name, iteration counter, gate results,
 * alignment score, Figma/Chromatic links, and contextual action buttons.
 */
export function ReviewSessionPanel({
  session,
  onAdvanceIteration,
  onEscalate,
  onMarkReady,
}: ReviewSessionPanelProps) {
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);

  const passCount = session.gateResults.filter(
    (g) => g.status === 'pass'
  ).length;
  const totalGates = 5;

  const handleAdvance = async () => {
    setIsAdvancing(true);
    try {
      await onAdvanceIteration();
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleEscalate = async () => {
    setIsEscalating(true);
    try {
      await onEscalate();
    } finally {
      setIsEscalating(false);
    }
  };

  const handleMarkReady = async () => {
    setIsMarkingReady(true);
    try {
      await onMarkReady();
    } finally {
      setIsMarkingReady(false);
    }
  };

  return (
    <aside
      className="w-80 shrink-0 flex flex-col h-full border-r border-zinc-800 bg-zinc-900/60 overflow-y-auto"
      aria-label="Design review session panel"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-800 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-widest mb-1">
              Component
            </p>
            <h2 className="text-sm font-bold text-zinc-100 leading-tight">
              {session.component}
            </h2>
          </div>
          <StatusBadge status={session.status} />
        </div>

        {/* Iteration Chip */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">Iteration</span>
          <div className="flex gap-1">
            {([1, 2] as const).map((n) => (
              <span
                key={n}
                className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold border ${
                  session.iteration === n
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : session.iteration > n
                      ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-600'
                }`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Links */}
      {(session.figmaUrl || session.chromaticBuildUrl) && (
        <div className="px-4 py-3 border-b border-zinc-800 space-y-1.5">
          {session.figmaUrl && (
            <a
              href={session.figmaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">Figma Frame</span>
            </a>
          )}
          {session.chromaticBuildUrl && (
            <a
              href={session.chromaticBuildUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">Chromatic Build</span>
            </a>
          )}
        </div>
      )}

      {/* Gate Results */}
      <div className="px-3 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-widest">
            Review Gates
          </p>
          <span className="text-[10px] text-zinc-500">
            {passCount}/{totalGates} passed
          </span>
        </div>
        <GateList gateResults={session.gateResults} />
      </div>

      {/* Alignment Score */}
      {session.alignmentScore !== undefined && (
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-widest mb-2">
            Alignment Score
          </p>
          <div className="flex items-end gap-2">
            <span
              className={`text-3xl font-extrabold ${
                session.alignmentScore >= 90
                  ? 'text-emerald-400'
                  : session.alignmentScore >= 70
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {session.alignmentScore}
            </span>
            <span className="text-zinc-500 text-sm pb-1">/ 100</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                session.alignmentScore >= 90
                  ? 'bg-emerald-500'
                  : session.alignmentScore >= 70
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${session.alignmentScore}%` }}
            />
          </div>
          {session.alignmentScore < 90 && (
            <p className="text-[10px] text-amber-400 mt-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Below 90% threshold — escalation recommended
            </p>
          )}
        </div>
      )}

      {/* Design Resources */}
      <div className="px-4 py-2 border-b border-zinc-800">
        <DesignResourcePanel />
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-4 mt-auto space-y-2">
        {/* Continue to Iteration 2: only shown when iter=1 and still in progress */}
        {session.iteration === 1 && session.status === 'IN_PROGRESS' && (
          <button
            id="design-review-advance-iteration-btn"
            onClick={handleAdvance}
            disabled={isAdvancing}
            className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-60 text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
            title="Mark Iteration 1 complete and begin Iteration 2 verification"
          >
            {isAdvancing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Continue to Iteration 2
          </button>
        )}

        {/* Iteration 2 actions: only shown on iteration 2 */}
        {session.iteration === 2 && session.status === 'IN_PROGRESS' && (
          <>
            <button
              id="design-review-mark-ready-btn"
              onClick={handleMarkReady}
              disabled={isMarkingReady}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
            >
              {isMarkingReady ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Ready for Designer Gate
            </button>
            <button
              id="design-review-escalate-btn"
              onClick={handleEscalate}
              disabled={isEscalating}
              className="w-full flex items-center justify-center gap-2 bg-amber-800/60 hover:bg-amber-700/60 disabled:opacity-60 text-amber-300 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
            >
              {isEscalating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              Escalate to Design Debt
            </button>
          </>
        )}

        {/* Terminal states */}
        {session.status === 'READY_FOR_DESIGNER_GATE' && (
          <p className="text-xs text-emerald-400 text-center py-1">
            ✓ Awaiting designer sign-off
          </p>
        )}
        {session.status === 'ESCALATED' && (
          <p className="text-xs text-amber-400 text-center py-1">
            ⚠ Logged in design-debt.md
          </p>
        )}
      </div>
    </aside>
  );
}
