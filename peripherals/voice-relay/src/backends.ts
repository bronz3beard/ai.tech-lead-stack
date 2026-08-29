import { execFile, spawn } from 'node:child_process';
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
import type { ChildProcess } from 'node:child_process';

export const activeProcesses = new Map<string, ChildProcess>();
export const abortedRequests = new Set<string>();

export function killProcess(requestId: string) {
  const child = activeProcesses.get(requestId);
  if (!child || !child.pid) return;
  console.log(`[Relay] Cancelling process for reqId: ${requestId} (PID: ${child.pid})`);
  try {
    // Kill the entire process group
    process.kill(-child.pid, 'SIGTERM');
    // Follow up with SIGKILL after a grace period
    setTimeout(() => {
      try {
        process.kill(-child.pid!, 'SIGKILL');
        console.log(`[Relay] SIGKILL delivered to pgid: -${child.pid}`);
      } catch (e) {
        // usually ESRCH meaning it already died
      }
    }, 2000);
  } catch (e) {
    console.error(`[Relay] Failed to kill process ${child.pid}:`, e);
  }
}

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

// Helper to spawn a child properly detached so it forms its own process group
function spawnDetached(command: string, args: string[], options: any) {
  const { timeout, maxBuffer = 1024 * 1024, ...spawnOpts } = options;
  const child = spawn(command, args, { ...spawnOpts, detached: true });
  const promise = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timer: NodeJS.Timeout | null = null;
    
    if (timeout) {
      timer = setTimeout(() => {
        child.kill('SIGTERM');
        const err = new Error(`Command timed out after ${timeout}ms`);
        (err as any).code = 'ETIMEDOUT';
        (err as any).killed = true;
        reject(err);
      }, timeout);
    }

    const checkBuffer = () => {
      if (stdout.length + stderr.length > maxBuffer) {
        child.kill('SIGTERM');
        const err = new Error('stdout maxBuffer exceeded');
        if (timer) clearTimeout(timer);
        reject(err);
      }
    };

    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
      checkBuffer();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
      checkBuffer();
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code !== 0) {
        const err = new Error(`Command failed with code ${code}`);
        (err as any).stdout = stdout;
        (err as any).stderr = stderr;
        (err as any).code = code;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
  return Object.assign(promise, { child });
}

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
  label = `Local (Ollama ${OLLAMA_MODEL})`;
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
    const ctx = await loadSkillContext(input.skill?.skill, input.skill?.workflow, input.cwd);
    const system = 
      'You are a conversational voice assistant answering questions about a codebase. ' +
      'You MUST provide your response in two formats using XML tags: <spoken> and <markdown>.\n' +
      '1. Inside <spoken>, provide a ruthlessly brief, conversational response meant to be read by a Text-to-Speech engine. ' +
      'NEVER use Markdown formatting here. NEVER repeat information (e.g. do not count with numbers and words). ' +
      '2. Inside <markdown>, provide the full, structured technical response with code blocks and lists for the UI.\n' +
      '3. Do not propose file edits.\n' +
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
      // Store local Ollama controller if we wanted to abort it, but we use fetch signal natively on client now.
      const data: any = await res.json();
      const rawContent = data?.message?.content ?? '';
      
      let spokenText = undefined;
      let text = rawContent;

      const spokenMatch = rawContent.match(/<spoken>([\s\S]*?)<\/spoken>/i);
      const markdownMatch = rawContent.match(/<markdown>([\s\S]*?)<\/markdown>/i);

      if (spokenMatch) {
        spokenText = spokenMatch[1].trim();
      }
      if (markdownMatch) {
        text = markdownMatch[1].trim();
      }

      return { ok: true, text, spokenText, raw: data };
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
  proposeArgs: (prompt: string, cwd: string) => string[];
  // WRITE invocation (only runs after explicit approval):
  applyArgs: (prompt: string, cwd: string) => string[];
  // read-only Q&A:
  askArgs: (prompt: string, cwd: string) => string[];
  parse?: (stdout: string) => string; // pull a human summary out of stdout/JSON
}

const PLAN_GUARD =
  'PLAN ONLY. Do NOT edit, create, or delete any files or run mutating commands. ' +
  'Produce a concise plan of what you WOULD change and why. Then stop.\n\n';

const TARGET_PROMPT = (cwd: string, prompt: string) => `You are operating on the repository at ${cwd}. Read and write ONLY within it. You MAY read skills from the tech-lead-stack path via the provided symlink/get_skills, but tech-lead-stack is NOT the project and must not be described, analyzed, or modified as the target.\n\n${prompt}`;

export const CLI_TOOLS: Record<string, CliTool> = {
  antigravity: {
    bin: 'agy',
    label: 'Antigravity (Ultra, OAuth)',
    authPath: 'subscription-oauth', // free under Ultra; consumer OAuth has daily limits
    authProbeArgs: ['agent'], // 'agy agent' or similar should work to test basic functionality/auth
    proposeArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, p), '--mode', 'plan', '--dangerously-skip-permissions', '--add-dir', cwd, '--max-turns', '12'],
    applyArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, p), '--mode', 'accept-edits', '--dangerously-skip-permissions', '--add-dir', cwd, '--max-turns', '25'],
    askArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, p), '--mode', 'plan', '--dangerously-skip-permissions', '--add-dir', cwd, '--max-turns', '6'],
  },
  claude: {
    bin: 'claude',
    label: 'Claude Code (login — VERIFY billing)',
    authPath: 'subscription-login-check-billing', // claude -p may draw from a metered Agent-SDK pool
    authProbeArgs: ['config', 'info'], // 'claude config info' or similar
    proposeArgs: (p, cwd) => [
      '-p',
      TARGET_PROMPT(cwd, p),
      '--permission-mode',
      'plan',
      '--output-format',
      'json',
      '--max-turns',
      '12',
    ],
    applyArgs: (p, cwd) => [
      '-p',
      TARGET_PROMPT(cwd, p),
      '--permission-mode',
      'acceptEdits',
      '--output-format',
      'json',
      '--max-turns',
      '25',
    ],
    askArgs: (p, cwd) => [
      '-p',
      TARGET_PROMPT(cwd, p),
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
    proposeArgs: (p, cwd) => ['exec', '--sandbox', 'read-only', '--json', TARGET_PROMPT(cwd, PLAN_GUARD + p)],
    applyArgs: (p, cwd) => ['exec', '--sandbox', 'workspace-write', '--json', TARGET_PROMPT(cwd, p)],
    askArgs: (p, cwd) => ['exec', '--sandbox', 'read-only', '--json', TARGET_PROMPT(cwd, 'Answer read-only.\n\n' + p)],
  },
  cursor: {
    bin: 'cursor-agent',
    label: 'Cursor',
    authPath: 'subscription-login',
    requiresWorktreeForReadOnly: true, // Assuming no true plan mode
    authProbeArgs: ['--status'],
    proposeArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, PLAN_GUARD + p)],
    applyArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, p)],
    askArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, 'Answer read-only, do not edit files.\n\n' + p)],
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

  private async run(args: string[], cwd: string, readonly: boolean = false, requestId?: string): Promise<AgentResult> {
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

    if (requestId && abortedRequests.has(requestId)) {
      if (worktreeDir) {
        try {
          await pexec('git', ['worktree', 'remove', '--force', worktreeDir], { cwd });
        } catch (e) {}
      }
      return { ok: false, text: '', error: 'Request aborted by client' };
    }

    try {
      const childPromise = spawnDetached(
        this.tool.bin,
        args,
        {
          cwd: runCwd,
          timeout: 1000 * 60 * 10,
          maxBuffer: 1024 * 1024 * 32,
        }
      );
      
      const child = childPromise.child;
      if (requestId) {
        activeProcesses.set(requestId, child);
      }
      
      console.log(`[Relay] Child process spawned (PID: ${child.pid}, requestId: ${requestId})`);
      
      const { stdout } = await childPromise;
      
      console.log(`[Relay] Child process exited cleanly (PID: ${child.pid}, requestId: ${requestId})`);
      
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
    
    if (requestId) {
      activeProcesses.delete(requestId);
    }

    if (runError) {
      return { ok: false, text: '', error: runError };
    }
    return { ok: runOk, text: resultText.trim(), raw: resultRaw };
  }

  async ask(input: RunInput): Promise<AgentResult> {
    return this.run(this.tool.askArgs(input.prompt, input.cwd), input.cwd, true, input.requestId);
  }

  async propose(input: RunInput): Promise<ProposalResult> {
    const r = await this.run(this.tool.proposeArgs(input.prompt, input.cwd), input.cwd, true, input.requestId);
    // summary = first ~2 sentences of the plan, for speaking aloud
    const summary = r.text
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(' ')
      .slice(0, 400);
    return { ...r, summary, diffPreview: r.text };
  }

  async apply(input: RunInput): Promise<AgentResult> {
    return this.run(this.tool.applyArgs(input.prompt, input.cwd), input.cwd, false, input.requestId);
  }
}

// Build all backends and detect which are usable right now.
export async function buildBackends(): Promise<AgentBackend[]> {
  const backends: AgentBackend[] = [new LocalOllamaBackend()];
  for (const [id, tool] of Object.entries(CLI_TOOLS))
    backends.push(new CliBackend(id, tool));
  return backends;
}
