import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import dotenv from 'dotenv';
import type { ChildProcess } from 'node:child_process';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { guardSpoken } from './guard-client.js';
import { detectTaskClass, validateByTaskClass, type TaskClass } from './spoken-guard.js';
import { logResponse } from './db/sqlite-logger.js';

export function applyHarness(prompt: string, taskClass: TaskClass): string {
  switch (taskClass) {
    case 'sequence':
      return `${prompt}\n\n[STRICT HARNESS] This is a sequence request. Your 'spoken' field MUST contain ONLY the sequence items. You are FORBIDDEN from including code, 'alternative formats', or conversational padding.`;
    case 'arithmetic':
      return `${prompt}\n\n[STRICT HARNESS] This is an arithmetic request. Your 'spoken' field MUST contain ONLY the final answer. DO NOT include steps, code, or explanations.`;
    case 'definition':
      return `${prompt}\n\n[STRICT HARNESS] This is a definition request. Your 'spoken' field MUST be a MAXIMUM of 3 sentences. DO NOT include code or conversational padding.`;
    default:
      return prompt;
  }
}
import type {
  AgentBackend,
  AgentResult,
  AuthPath,
  DetectResult,
  ProposalResult,
  RunInput,
} from './types.js';

/**
 * Map of active child processes spawned by this backend, keyed by requestId.
 * This allows us to track and terminate long-running processes if a request is cancelled.
 */
export const activeProcesses = new Map<string, ChildProcess>();

/**
 * Set of request IDs that have been explicitly aborted by the client.
 * Any newly started process for these IDs will be immediately terminated.
 */
export const abortedRequests = new Set<string>();

/**
 * Forcefully terminates a running process and its entire process tree using the process group ID.
 *
 * @param requestId The unique identifier for the request whose process should be killed.
 */
export function killProcess(requestId: string) {
  const child = activeProcesses.get(requestId);
  if (!child || !child.pid) return;
  console.log(
    `[Relay] Cancelling process for reqId: ${requestId} (PID: ${child.pid})`
  );
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

/**
 * Helper to dynamically determine the current directory.
 * Provides fallback support depending on whether the code is running in a bundled
 * environment or locally from a specific working directory.
 *
 * @returns The absolute path to the src directory of voice-relay.
 */
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

// Load tech-lead-stack root .env for shared keys like GEMINI_API_KEY
const rootEnvPath = path.resolve(getDirname(), '../../../.env');
dotenv.config({ path: rootEnvPath, override: false });

/**
 * Spawns a child process in detached mode so it forms its own process group.
 * This ensures that when we send a kill signal to the group (e.g. `-pid`), it terminates
 * the child process and all of its spawned subprocesses, preventing zombie processes.
 *
 * @param command The binary or command to run.
 * @param args The arguments to pass to the command.
 * @param options Spawn options, including custom `timeout` and `maxBuffer`.
 * @returns A promise that resolves with stdout and stderr, and exposes the underlying child process.
 */
function spawnDetached(command: string, args: string[], options: any) {
  const { timeout, maxBuffer = 1024 * 1024, ...spawnOpts } = options;
  const child = spawn(command, args, { ...spawnOpts, detached: true });
  const promise = new Promise<{ stdout: string; stderr: string }>(
    (resolve, reject) => {
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
    }
  );
  return Object.assign(promise, { child });
}

const STACK_REPO =
  process.env.STACK_REPO || path.resolve(getDirname(), '../../../');

/**
 * Loads a markdown file representing a specific skill or workflow to use as context for the model.
 * Currently uses an MCP Stdio connection to `tech-lead-stack` to retrieve the content dynamically.
 *
 * @param skillName The name of the specific skill to load (optional).
 * @param workflowName The name of the specific workflow to load (optional).
 * @param cwd The target project directory (optional).
 * @returns The markdown content of the skill/workflow, or an empty string if not found.
 */
async function loadSkillContext(
  skillName?: string,
  workflowName?: string,
  cwd?: string
): Promise<string> {
  const target = skillName || workflowName;
  if (!target) return '';

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', path.join(STACK_REPO, 'src/mcp-server/index.ts')],
    env: { ...process.env, REPOS_ROOT: process.env.REPOS_ROOT || '' },
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
      },
    });

    if (
      result.isError ||
      !Array.isArray(result.content) ||
      result.content.length === 0
    ) {
      return '';
    }

    const content = result.content[0] as { type: string; text: string };
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
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:9b';

/**
 * Backend implementation for interacting with a local Ollama instance.
 * It is read-only and designed to answer factual or codebase questions using local LLM inference.
 */
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
    const ctx = await loadSkillContext(
      input.skill?.skill,
      input.skill?.workflow,
      input.cwd
    );
    const system =
      'You are a conversational voice assistant answering questions about a codebase. ' +
      'You MUST respond as valid JSON with exactly two fields:\n' +
      '"spoken": Plain speech for a Text-to-Speech engine. Rules:\n' +
      '  - NO markdown formatting whatsoever (no *, #, `, _, -, >, []()), no code blocks\n' +
      '  - NO numbered/ordered lists (never prefix items with "1.", "2.", etc.)\n' +
      '  - NO bullet points\n' +
      '  - NO preamble ("Here is...", "Sure...", "Certainly...")\n' +
      '  - NO epilogue ("Let me know...", "Hope this helps...")\n' +
      '  - For sequences or enumerations: bare items only, separated by commas or spaces\n' +
      '  - For code: describe what the code does conversationally, never output raw code\n' +
      '  - Keep it ruthlessly brief — say only what answers the question\n\n' +
      '"markdown": Structured response with rich formatting for screen display.\n' +
      '  - May use headers, lists, code blocks, bold, links\n' +
      '  - MUST contain the SAME factual information as spoken — nothing added, nothing dropped\n\n' +
      (ctx ? `Follow this methodology when relevant:\n${ctx}\n` : '');
    const taskClass = detectTaskClass(input.prompt);
    const harnessedPrompt = applyHarness(input.prompt, taskClass);
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(1000 * 60 * 5),
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          options: { temperature: 0 },
          format: {
            type: 'object',
            properties: {
              spoken: { type: 'string' },
              markdown: { type: 'string' },
            },
            required: ['spoken', 'markdown'],
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Repo: ${input.cwd}\n\n${harnessedPrompt}` },
          ],
        }),
      });
      // Store local Ollama controller if we wanted to abort it, but we use fetch signal natively on client now.
      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Ollama API returned ${res.status}`);
      }
      const rawContent = data?.message?.content ?? '';

      let spokenText = undefined;
      let text = rawContent;

      try {
        const parsed = JSON.parse(rawContent);
        if (parsed.spoken) spokenText = parsed.spoken.trim();
        if (parsed.markdown) text = parsed.markdown.trim();
      } catch (e) {
        // Backward compat fallback to XML parsing
        const spokenMatch = rawContent.match(/<spoken>([\s\S]*?)<\/spoken>/i);
        const markdownMatch = rawContent.match(
          /<markdown>([\s\S]*?)<\/markdown>/i
        );
        if (spokenMatch) {
          spokenText = spokenMatch[1].trim();
        }
        if (markdownMatch) {
          text = markdownMatch[1].trim();
        }
      }

      if (spokenText) {
        const rawSpoken = spokenText;
        const val = validateByTaskClass(spokenText, input.prompt, taskClass);
        if (!val.ok || val.confidence === 'low') {
          const guardRes = await guardSpoken(input.prompt, spokenText, text, taskClass);
          spokenText = guardRes.repaired_spoken;
        }
        
        logResponse({
          prompt: input.prompt,
          task_class: taskClass,
          raw_markdown: text,
          raw_spoken: rawSpoken,
          repaired_spoken: spokenText
        });
      }

      return { ok: true, text, spokenText, raw: data };
    } catch (e: any) {
      let errStr = e?.message ?? 'ollama request failed';
      if (e?.name === 'TimeoutError' || errStr.includes('aborted')) {
        errStr = 'Local Ollama timed out. Is the model too slow?';
      } else if (
        e?.cause?.code === 'ECONNREFUSED' ||
        errStr.includes('ECONNREFUSED') ||
        errStr.includes('fetch failed')
      ) {
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

/**
 * Configuration structure for defining how to interact with external CLI-based agent tools.
 */
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

const TARGET_PROMPT = (cwd: string, prompt: string) =>
  `You are operating on the repository at ${cwd}. Read and write ONLY within it. You MAY read skills from the tech-lead-stack path via the provided symlink/get_skills, but tech-lead-stack is NOT the project and must not be described, analyzed, or modified as the target.\n\n${prompt}`;

/**
 * A registry of supported CLI tools, providing the specific arguments needed to run them
 * in different modes (probe auth, plan, accept edits, read-only questions).
 */
export const CLI_TOOLS: Record<string, CliTool> = {
  antigravity: {
    bin: 'agy',
    label: 'Antigravity (Ultra, OAuth)',
    authPath: 'subscription-oauth', // free under Ultra; consumer OAuth has daily limits
    authProbeArgs: ['agent'], // 'agy agent' or similar should work to test basic functionality/auth
    proposeArgs: (p, cwd) => [
      '-p',
      TARGET_PROMPT(cwd, p),
      '--mode',
      'plan',
      '--dangerously-skip-permissions',
      '--add-dir',
      cwd,
    ],
    applyArgs: (p, cwd) => [
      '-p',
      TARGET_PROMPT(cwd, p),
      '--mode',
      'accept-edits',
      '--dangerously-skip-permissions',
      '--add-dir',
      cwd,
    ],
    askArgs: (p, cwd) => [
      '-p',
      TARGET_PROMPT(cwd, p),
      '--mode',
      'plan',
      '--dangerously-skip-permissions',
      '--add-dir',
      cwd,
    ],
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
    proposeArgs: (p, cwd) => [
      'exec',
      '--sandbox',
      'read-only',
      '--json',
      TARGET_PROMPT(cwd, PLAN_GUARD + p),
    ],
    applyArgs: (p, cwd) => [
      'exec',
      '--sandbox',
      'workspace-write',
      '--json',
      TARGET_PROMPT(cwd, p),
    ],
    askArgs: (p, cwd) => [
      'exec',
      '--sandbox',
      'read-only',
      '--json',
      TARGET_PROMPT(cwd, 'Answer read-only.\n\n' + p),
    ],
  },
  cursor: {
    bin: 'cursor-agent',
    label: 'Cursor',
    authPath: 'subscription-login',
    requiresWorktreeForReadOnly: true, // Assuming no true plan mode
    authProbeArgs: ['--status'],
    proposeArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, PLAN_GUARD + p)],
    applyArgs: (p, cwd) => ['-p', TARGET_PROMPT(cwd, p)],
    askArgs: (p, cwd) => [
      '-p',
      TARGET_PROMPT(cwd, 'Answer read-only, do not edit files.\n\n' + p),
    ],
  },
};

/**
 * A generic backend wrapper that drives external CLI agent tools (like agy, claude, codex, or cursor).
 * It manages executing the CLI, handling timeouts, buffering I/O, and optionally setting up
 * read-only git worktrees to prevent destructive changes during planning/read phases.
 */
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

  private async run(
    args: string[],
    cwd: string,
    readonly: boolean = false,
    requestId?: string
  ): Promise<AgentResult> {
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
          await pexec('git', ['worktree', 'remove', '--force', worktreeDir], {
            cwd,
          });
        } catch (e) {}
      }
      return { ok: false, text: '', error: 'Request aborted by client' };
    }

    try {
      const childPromise = spawnDetached(this.tool.bin, args, {
        cwd: runCwd,
        timeout: 1000 * 60 * 10,
        maxBuffer: 1024 * 1024 * 32,
      });

      const child = childPromise.child;
      if (requestId) {
        activeProcesses.set(requestId, child);
      }

      console.log(
        `[Relay] Child process spawned (PID: ${child.pid}, requestId: ${requestId})`
      );

      const { stdout } = await childPromise;

      console.log(
        `[Relay] Child process exited cleanly (PID: ${child.pid}, requestId: ${requestId})`
      );

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
        await pexec('git', ['worktree', 'remove', '--force', worktreeDir], {
          cwd,
        });
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
    const taskClass = detectTaskClass(input.prompt);
    const harnessedPrompt = applyHarness(input.prompt, taskClass);
    
    const result = await this.run(
      this.tool.askArgs(harnessedPrompt, input.cwd),
      input.cwd,
      true,
      input.requestId
    );
    
    if (result.ok && result.text) {
      const rawText = result.text;
      let repairedText = rawText;
      const val = validateByTaskClass(rawText, input.prompt, taskClass);
      
      if (!val.ok || val.confidence === 'low') {
        const guardRes = await guardSpoken(input.prompt, rawText, rawText, taskClass);
        repairedText = guardRes.repaired_spoken;
        result.text = repairedText;
      }
      
      logResponse({
        prompt: input.prompt,
        task_class: taskClass,
        raw_markdown: rawText,
        raw_spoken: rawText,
        repaired_spoken: repairedText
      });
    }
    
    return result;
  }

  async propose(input: RunInput): Promise<ProposalResult> {
    const r = await this.run(
      this.tool.proposeArgs(input.prompt, input.cwd),
      input.cwd,
      true,
      input.requestId
    );
    // summary = first ~2 sentences of the plan, for speaking aloud
    const summary = r.text
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(' ')
      .slice(0, 400);
    return { ...r, summary, diffPreview: r.text };
  }

  async apply(input: RunInput): Promise<AgentResult> {
    return this.run(
      this.tool.applyArgs(input.prompt, input.cwd),
      input.cwd,
      false,
      input.requestId
    );
  }
}

/**
 * Initializes and returns an array of all available and configured AgentBackends.
 * It registers the LocalOllamaBackend and dynamically registers all CLI tools defined in CLI_TOOLS.
 *
 * @returns A list of initialized backend instances ready to be detected and used.
 */
export async function buildBackends(): Promise<AgentBackend[]> {
  const backends: AgentBackend[] = [new LocalOllamaBackend()];
  for (const [id, tool] of Object.entries(CLI_TOOLS))
    backends.push(new CliBackend(id, tool));
  return backends;
}
