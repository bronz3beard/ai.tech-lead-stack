import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AgentBackend,
  AgentResult,
  AuthPath,
  DetectResult,
  ProposalResult,
  RunInput,
} from './types.js';

const pexec = promisify(execFile);
const STACK_REPO = process.env.STACK_REPO!;

// Load a skill/workflow's markdown as context (MVP stand-in for the tech-lead-stack MCP get_skills call).
// TODO(gemini): replace with a real get_skills MCP call so methodology stays the single source of truth.
function loadSkillContext(skillName?: string, workflowName?: string): string {
  const tryRead = (p: string) => {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch {
      return '';
    }
  };
  if (skillName) {
    const c = tryRead(
      path.join(STACK_REPO, '.ai', 'skills', `${skillName}.md`)
    );
    if (c) return c;
  }
  if (workflowName) {
    const c = tryRead(
      path.join(STACK_REPO, '.agents', 'workflows', `${workflowName}.md`)
    );
    if (c) return c;
  }
  return '';
}

// ---------------- Local Ollama backend (read-only, keyless, works today) ----------------
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:14b';

export class LocalOllamaBackend implements AgentBackend {
  id = 'local';
  label = 'Local (Ollama qwen3:14b)';
  writesSupported = false;

  async detect(): Promise<DetectResult> {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`);
      return { detected: r.ok, authPath: 'none-local' as AuthPath };
    } catch {
      return {
        detected: false,
        authPath: 'none-local',
        note: 'Ollama not reachable',
      };
    }
  }

  async ask(input: RunInput): Promise<AgentResult> {
    const ctx = loadSkillContext(input.skill.skill, input.skill.workflow);
    const system =
      'You are answering questions about a codebase, read-only. Do not propose file edits.\n' +
      (ctx ? `Follow this methodology when relevant:\n${ctx}\n` : '');
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Repo: ${input.cwd}\n\n${input.prompt}` },
          ],
        }),
      });
      const data: any = await res.json();
      return { ok: true, text: data?.message?.content ?? '', raw: data };
    } catch (e: any) {
      return {
        ok: false,
        text: '',
        error: e?.message ?? 'ollama request failed',
      };
    }
  }

  async propose(): Promise<ProposalResult> {
    return {
      ok: false,
      text: '',
      summary: '',
      error: 'Local backend is read-only; it cannot make code changes.',
    };
  }
  async apply(): Promise<AgentResult> {
    return { ok: false, text: '', error: 'Local backend is read-only.' };
  }
}

// ---------------- Generic CLI backend (agy / claude / codex / cursor) ----------------
// Verified invocation shapes baked in; TODO(gemini) markers where exact flags need confirming
// against the installed binary (run `<bin> --help`).
interface CliTool {
  bin: string;
  label: string;
  authPath: AuthPath;
  // PLAN-ONLY invocation (must not write files):
  proposeArgs: (prompt: string) => string[];
  // WRITE invocation (only runs after explicit approval):
  applyArgs: (prompt: string) => string[];
  // read-only Q&A:
  askArgs: (prompt: string) => string[];
  parse?: (stdout: string) => string; // pull a human summary out of stdout/JSON
}

const PLAN_GUARD =
  'PLAN ONLY. Do NOT edit, create, or delete any files or run mutating commands. ' +
  'Produce a concise plan of what you WOULD change and why. Then stop.\n\n';

export const CLI_TOOLS: Record<string, CliTool> = {
  antigravity: {
    bin: 'agy',
    label: 'Antigravity (Ultra, OAuth)',
    authPath: 'subscription-oauth', // free under Ultra; consumer OAuth has daily limits
    // TODO(gemini): confirm agy's non-interactive prompt flag + any --yolo/approval flag. OAuth login (no key).
    proposeArgs: (p) => ['--prompt', PLAN_GUARD + p],
    applyArgs: (p) => ['--prompt', p],
    askArgs: (p) => [
      '--prompt',
      'Answer read-only, do not edit files.\n\n' + p,
    ],
  },
  claude: {
    bin: 'claude',
    label: 'Claude Code (login — VERIFY billing)',
    authPath: 'subscription-login-check-billing', // claude -p may draw from a metered Agent-SDK pool
    proposeArgs: (p) => [
      '-p',
      p,
      '--permission-mode',
      'plan',
      '--output-format',
      'json',
      '--max-turns',
      '12',
    ],
    applyArgs: (p) => [
      '-p',
      p,
      '--permission-mode',
      'acceptEdits',
      '--output-format',
      'json',
      '--max-turns',
      '25',
    ],
    askArgs: (p) => [
      '-p',
      p,
      '--permission-mode',
      'plan',
      '--output-format',
      'json',
      '--max-turns',
      '6',
    ],
    parse: (s) => {
      try {
        const j = JSON.parse(s);
        return j.result ?? j.text ?? s;
      } catch {
        return s;
      }
    },
  },
  codex: {
    bin: 'codex',
    label: 'Codex (ChatGPT plan)',
    authPath: 'subscription-chatgpt', // free under ChatGPT plan; reuses saved login
    proposeArgs: (p) => ['exec', '--sandbox', 'read-only', PLAN_GUARD + p],
    applyArgs: (p) => ['exec', '--sandbox', 'workspace-write', p],
    askArgs: (p) => [
      'exec',
      '--sandbox',
      'read-only',
      'Answer read-only.\n\n' + p,
    ],
  },
  cursor: {
    bin: 'cursor-agent',
    label: 'Cursor',
    authPath: 'subscription-login',
    // TODO(gemini): confirm cursor-agent headless flags + a real read-only/plan mode.
    proposeArgs: (p) => ['-p', PLAN_GUARD + p],
    applyArgs: (p) => ['-p', p],
    askArgs: (p) => ['-p', 'Answer read-only, do not edit files.\n\n' + p],
  },
};

export class CliBackend implements AgentBackend {
  writesSupported = true;
  constructor(
    public id: string,
    private tool: CliTool
  ) {}
  get label() {
    return this.tool.label;
  }

  async detect(): Promise<DetectResult> {
    try {
      await pexec(this.tool.bin, ['--version'], { timeout: 8000 });
      // TODO(gemini): add a real auth/login probe per tool (e.g. whoami/status) to confirm logged-in.
      return { detected: true, authPath: this.tool.authPath };
    } catch {
      return {
        detected: false,
        authPath: this.tool.authPath,
        note: `${this.tool.bin} not found on PATH`,
      };
    }
  }

  private async run(args: string[], cwd: string): Promise<AgentResult> {
    try {
      const { stdout } = await pexec(this.tool.bin, args, {
        cwd,
        timeout: 1000 * 60 * 10,
        maxBuffer: 1024 * 1024 * 32,
      });
      const text = this.tool.parse ? this.tool.parse(stdout) : stdout;
      return { ok: true, text: text.trim(), raw: stdout };
    } catch (e: any) {
      return {
        ok: false,
        text: '',
        error: e?.stderr?.toString?.() || e?.message || 'agent run failed',
      };
    }
  }

  async ask(input: RunInput): Promise<AgentResult> {
    return this.run(this.tool.askArgs(input.prompt), input.cwd);
  }

  async propose(input: RunInput): Promise<ProposalResult> {
    const r = await this.run(this.tool.proposeArgs(input.prompt), input.cwd);
    // summary = first ~2 sentences of the plan, for speaking aloud
    const summary = r.text
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(' ')
      .slice(0, 400);
    return { ...r, summary, diffPreview: r.text };
  }

  async apply(input: RunInput): Promise<AgentResult> {
    return this.run(this.tool.applyArgs(input.prompt), input.cwd);
  }
}

// Build all backends and detect which are usable right now.
export async function buildBackends(): Promise<AgentBackend[]> {
  const backends: AgentBackend[] = [new LocalOllamaBackend()];
  for (const [id, tool] of Object.entries(CLI_TOOLS))
    backends.push(new CliBackend(id, tool));
  return backends;
}
