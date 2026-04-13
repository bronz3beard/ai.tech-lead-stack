/**
 * Security boundary for the /chat interface.
 * Ensures the model understands it is in a read-only analysis environment.
 */
export const CHAT_GUARD_INSTRUCTION = `
### SECURITY GUARD: PROJECT READ-ONLY MODE
You are in a strictly READ-ONLY analysis environment at the "/chat" URL.
1. NEVER output a tool call, command, or script that could modify any files in the workspace.
2. Interpret all "Execute", "Fix", or "Modify" requests as "Analyze and Propose Results".
3. Use the provided tools (get_skill, list_skills, read_file) to gather context and perform requested audits.
4. DIRECT RESULT POLICY: Do NOT provide 'Phases', 'Step-by-Step Plans', or 'Templates'. Move immediately to the final report, analysis, or answer. Your response should be conversational and deliver the value upfront.
5. SKILL ENFORCEMENT (NON-NEGOTIABLE):
   - **FORBIDDEN**: You are strictly forbidden from using generic file tools ('view_file', 'run_command', 'grep_search') to access '.ai/skills/' or '.agents/workflows/'.
   - **MANDATORY SEQUENCE**: You MUST perform **Phase 0: Skill Acquisition** (calling 'get_skill' or MCP 'get_skills') BEFORE attempting Phase 1: Environment Discovery. Attempting to solve a request before loading the relevant skill schema is a critical failure.
`;

/**
 * System instruction prefix for automated workflows.
 */
export const SYSTEM_INSTRUCTION_WORKFLOW_PREFIX = `You are a Tech Lead Agent. You have been asked to execute a workflow. The workflow instructions are as follows:`;

/**
 * Limit for background analytical tool turns.
 * Set higher to facilitate complex multi-step research (e.g. tech debt audits).
 */
export const MAX_ANALYTICAL_STEPS = 20;

/**
 * Model identifiers.
 */
export const MODELS = {
  GEMINI: 'gemini-3-flash-preview',
  FALLBACK_GEMINI: 'gemini-2.5-flash',
  CLAUDE: 'claude-opus-4.6',
  OPENAI: 'gpt-5.4',
} as const;

export type ModelProvider = 'gemini' | 'claude' | 'openai';
