/**
 * @desc Shared types for the Design System Review session feature.
 * Used by the API route, ReviewSessionPanel, ReviewQueue, and the session page.
 */

/** @desc The 5 review gates defined in the design-system-review skill. */
export type GateId =
  | 'token-alignment'
  | 'shadcn-primitive'
  | 'logic-consistency'
  | 'storybook-figma'
  | 'chromatic';

export const GATE_LABELS: Record<GateId, string> = {
  'token-alignment': 'Token & Colour Alignment',
  'shadcn-primitive': 'Shadcn/Radix Primitive Usage',
  'logic-consistency': 'Logic & State Consistency',
  'storybook-figma': 'Storybook ↔ Figma Parity',
  chromatic: 'Chromatic Visual Regression',
};

export type GateStatus = 'pass' | 'fail' | 'pending' | 'skipped';

export interface GateResult {
  /** @desc Matches one of the 5 review gate IDs from the skill. */
  id: GateId;
  status: GateStatus;
  /** @desc Optional AI feedback or notes for this gate. */
  notes?: string;
}

export type ReviewStatus =
  | 'IN_PROGRESS'
  | 'READY_FOR_DESIGNER_GATE'
  | 'ESCALATED';

/**
 * @desc The metadata shape stored in `Chat.metadata` for design review sessions.
 * `reviewType` acts as the discriminator for filtering these chats.
 */
export interface ReviewSessionMetadata {
  reviewType: 'design-system-review';
  /** @desc Name of the component being reviewed (e.g. "Button", "DatePicker"). */
  component: string;
  figmaUrl?: string;
  chromaticBuildUrl?: string;
  iteration: 1 | 2;
  status: ReviewStatus;
  /** @desc 0–100 alignment score set by the AI after Iteration 2. */
  alignmentScore?: number;
  gateResults?: GateResult[];
}

/**
 * @desc The flattened, API-safe shape returned by GET /api/design-review.
 * Merges `Chat` fields with `ReviewSessionMetadata`.
 */
export interface ReviewSession {
  /** @desc Same as the underlying `Chat.id`. */
  id: string;
  component: string;
  figmaUrl?: string;
  chromaticBuildUrl?: string;
  iteration: 1 | 2;
  status: ReviewStatus;
  alignmentScore?: number;
  gateResults: GateResult[];
  projectId: string;
  createdAt: string;
  updatedAt: string;
}
