import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  AgentBackend,
  AgentResult,
  AuthPath,
  DetectResult,
  ProposalResult,
  RunInput,
} from './types.js';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  const cwd = process.cwd();
  return cwd.endsWith('voice-relay') 
    ? path.join(cwd, 'src') 
    : path.join(cwd, 'peripherals/voice-relay/src');
};

const pexec = promisify(execFile);
const STACK_REPO = process.env.STACK_REPO || path.resolve(getDirname(), '../../../');

// Load a skill/workflow's markdown as context (MVP stand-in for the tech-lead-stack MCP get_skills call).
// TODO(gemini): replace with a real get_skills MCP call so methodology stays the single source of truth.
async function loadSkillContext(skillName?: string, workflowName?: string, cwd?: string): Promise<string> {
  const target = skillName || workflowName;
  if (!target) return '';

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', path.join(STACK_REPO, 'src/mcp-server/index.ts')],
    env: { ...process.env, REPOS_ROOT: process.env.REPOS_ROOT || '' }
  });

  const client = new Client(
    { name: 'voice-relay', version: '0.1.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    
    const projectName = cwd ? path.basename(cwd) : undefined;

    const result = await client.callTool({
      name: 'get_skills',
      arguments: {
        skillName: target,
        projectName,
        model: 'voice-relay',
        agent: 'voice-relay',
      }
    });

    if (result.isError || !Array.isArray(result.content) || result.content.length === 0) {
      return '';
    }
    
    const content = result.content[0] as { type: string, text: string };
    if (content.type === 'text') {
      return content.text;
    }
    return '';
  } catch (e) {
    console.error('MCP get_skills failed:', e);
    return '';
  } finally {
    try {
      await client.close();
    } catch {}
  }
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
    const ctx = await loadSkillContext(input.skill.skill, input.skill.workflow, input.cwd);
    const system =
      'You are answering questions about a codebase, read-only. Do not propose file edits.\n' +
      (ctx ? `Follow this methodology when relevant:\n${ctx}\n` : '');
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(1000 * 60 * 5),
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
      let errStr = e?.message ?? 'ollama request failed';
      if (e?.name === 'TimeoutError' || errStr.includes('aborted')) {
        errStr = 'Local Ollama timed out. Is the model too slow?';
      } else if (e?.cause?.code === 'ECONNREFUSED' || errStr.includes('ECONNREFUSED') || errStr.includes('fetch failed')) {
        errStr = 'Local Ollama is unreachable. Please ensure it is running.';
      }
      return {
        ok: false,
        text: '',
        error: errStr,
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
interface CliTool {
  bin: string;
  label: string;
  authPath: AuthPath;
  requiresWorktreeForReadOnly?: boolean;
  // Auth probe invocation (should exit 0 if logged in, non-zero if not):
  authProbeArgs: string[];
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
    authProbeArgs: ['agent'], // 'agy agent' or similar should work to test basic functionality/auth
    proposeArgs: (p) => ['-p', p, '--mode', 'plan', '--dangerously-skip-permissions'],
    applyArgs: (p) => ['-p', p, '--mode', 'accept-edits', '--dangerously-skip-permissions'],
    askArgs: (p) => ['-p', p, '--mode', 'plan', '--dangerously-skip-permissions'],
  },
  claude: {
    bin: 'claude',
    label: 'Claude Code (login — VERIFY billing)',
    authPath: 'subscription-login-check-billing', // claude -p may draw from a metered Agent-SDK pool
    authProbeArgs: ['config', 'info'], // 'claude config info' or similar
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
    authProbeArgs: ['whoami'], // 'codex whoami'
    proposeArgs: (p) => ['exec', '--sandbox', 'read-only', '--json', PLAN_GUARD + p],
    applyArgs: (p) => ['exec', '--sandbox', 'workspace-write', '--json', p],
    askArgs: (p) => ['exec', '--sandbox', 'read-only', '--json', 'Answer read-only.\n\n' + p],
  },
  cursor: {
    bin: 'cursor-agent',
    label: 'Cursor',
    authPath: 'subscription-login',
    requiresWorktreeForReadOnly: true, // Assuming no true plan mode
    authProbeArgs: ['--status'],
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
      await pexec('which', [this.tool.bin], { timeout: 8000 });
      // Probe auth state using the tool's probe arguments
      try {
        await pexec(this.tool.bin, this.tool.authProbeArgs, { timeout: 8000 });
        return { detected: true, authPath: this.tool.authPath };
      } catch (authError) {
        return {
          detected: true, // Binary exists, but not logged in or probe failed
          authPath: this.tool.authPath,
          note: `${this.tool.bin} requires login`,
        };
      }
    } catch {
      return {
        detected: false,
        authPath: this.tool.authPath,
        note: `${this.tool.bin} not found on PATH`,
      };
    }
  }

  private async run(args: string[], cwd: string, readonly: boolean = false): Promise<AgentResult> {
    let runCwd = cwd;
    let worktreeDir = '';
    
    if (readonly && this.tool.requiresWorktreeForReadOnly) {
      worktreeDir = path.join(cwd, `.voice-relay-worktree-${Date.now()}`);
      try {
        await pexec('git', ['worktree', 'add', worktreeDir, '-d'], { cwd });
        runCwd = worktreeDir;
      } catch (e: any) {
        return {
          ok: false,
          text: '',
          error: `Failed to create read-only worktree: ${e.message}`,
        };
      }
    }

    let resultText = '';
    let resultRaw = '';
    let runError = null;
    let runOk = false;

    try {
      const { stdout } = await pexec(this.tool.bin, args, {
        cwd: runCwd,
        timeout: 1000 * 60 * 10,
        maxBuffer: 1024 * 1024 * 32,
      });
      resultRaw = stdout;
      resultText = this.tool.parse ? this.tool.parse(stdout) : stdout;
      runOk = true;
    } catch (e: any) {
      if (e?.killed) {
        runError = 'The agent was killed or timed out.';
      } else if (e?.code === 'ETIMEDOUT') {
        runError = 'The agent took too long and timed out.';
      } else {
        runError = e?.stderr?.toString?.() || e?.message || 'agent run failed';
        if (runError.length > 500) {
          runError = runError.slice(0, 500) + '... (truncated)';
        }
      }
    }

    if (worktreeDir) {
      try {
        await pexec('git', ['worktree', 'remove', '--force', worktreeDir], { cwd });
      } catch (e) {
        console.error(`Failed to cleanup worktree ${worktreeDir}:`, e);
      }
    }

    if (runError) {
      return { ok: false, text: '', error: runError };
    }
    return { ok: runOk, text: resultText.trim(), raw: resultRaw };
  }

  async ask(input: RunInput): Promise<AgentResult> {
    return this.run(this.tool.askArgs(input.prompt), input.cwd, true);
  }

  async propose(input: RunInput): Promise<ProposalResult> {
    const r = await this.run(this.tool.proposeArgs(input.prompt), input.cwd, true);
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
