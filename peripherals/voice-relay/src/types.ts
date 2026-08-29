// ---- Skill / workflow registry ----
export type SkillType = 'workflow' | 'skill';

export interface SkillEntry {
  id: string; // canonical id, e.g. "plan"
  aliases: string[]; // spoken + typed forms, e.g. ["plan","planning","slash plan","/plan"]
  type: SkillType; // "workflow" invokes the /workflow; "skill" loads the skill directly
  workflow?: string; // .agents/workflows/<workflow>.md  (name)
  skill?: string; // .ai/skills/<skill>.md            (name get_skills loads)
  writes: boolean; // true => MUST go propose -> approve -> apply. false => read-only /ask.
  description?: string;
}

export interface ResolvedSkill {
  entry: SkillEntry;
  prompt: string; // transcript with the matched alias phrase stripped off the front
}

// ---- Agent backends ----
export type AuthPath =
  | 'none-local' // Ollama, no auth
  | 'subscription-oauth' // agy (Ultra) — free under plan
  | 'subscription-chatgpt' // codex exec — free under plan
  | 'subscription-login-check-billing' // claude -p — MAY be metered (Agent SDK credit pool), verify
  | 'subscription-login' // cursor — assumed subscription; confirm
  | 'unknown';

export interface DetectResult {
  detected: boolean; // binary present + (best-effort) logged in
  authPath: AuthPath;
  note?: string;
}

export interface RunInput {
  prompt: string; // the full instruction handed to the agent
  cwd: string; // repo path the agent operates in
  skill?: SkillEntry;
  requestId?: string;
}

export interface AgentResult {
  ok: boolean;
  text: string; // human-readable answer / result summary (spoken back)
  raw?: unknown; // parsed JSON output if available
  error?: string;
}

export interface ProposalResult extends AgentResult {
  summary: string; // short, speakable "here's what I'll do"
  diffPreview?: string; // optional textual diff/plan detail
}

export interface AgentBackend {
  id: string; // "local" | "antigravity" | "claude" | "codex" | "cursor"
  label: string; // human label for the banner
  writesSupported: boolean;
  detect(): Promise<DetectResult>;
  ask(input: RunInput): Promise<AgentResult>; // read-only run (writes:false skills)
  propose(input: RunInput): Promise<ProposalResult>; // PLAN ONLY, no file writes
  apply(input: RunInput): Promise<AgentResult>; // write phase — only after explicit approval
}

// ---- Proposal store (the gate) ----
export interface Proposal {
  id: string;
  createdAt: number;
  backendId: string;
  skillId: string;
  prompt: string;
  cwd: string;
  summary: string;
  status: 'proposed' | 'approved' | 'applied' | 'rejected';
}
