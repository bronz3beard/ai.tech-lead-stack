#!/usr/bin/env node

/**
 * CRITICAL: Full stdout protection for MCP stdio transport.
 *
 * dotenv v17+ and other dependencies call process.stdout.write() directly,
 * bypassing console.log overrides. This intercept redirects ALL writes to
 * stderr before the MCP transport is connected, so no dependency advertisement
 * or log can corrupt the JSON-RPC stream.
 *
 * Once server.connect() is called, the MCP SDK takes ownership of stdout and
 * this intercept is no longer needed.
 */
let mcpTransportConnected = false;

const _originalStdoutWrite = process.stdout.write.bind(process.stdout);

process.stdout.write = (
  chunk: string | Uint8Array,
  encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
  callback?: (err?: Error | null) => void
): boolean => {
  if (!mcpTransportConnected) {
    // Redirect to stderr — don't let anything pollute stdout before MCP connects
    process.stderr.write(chunk as string | Uint8Array);
    const cb =
      typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
    if (cb) cb();
    return true;
  }
  if (typeof encodingOrCallback === 'function') {
    return _originalStdoutWrite(chunk, encodingOrCallback);
  }
  return _originalStdoutWrite(
    chunk,
    encodingOrCallback as BufferEncoding,
    callback
  );
};

// Also redirect console.log in case anything uses it
console.log = (...args: any[]) => {
  console.error(...args);
};

/**
 * Tech-Lead Stack MCP Server
 *
 * Refactored to follow SOLID principles (SRP, OCP, DIP).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import './config.js';
import { repoRoot } from './config.js';

import { KiService } from '../lib/ki/ki-service.js';
import { langfuseSink } from '../lib/langfuse-sink.js';
import { AlignmentService } from '../lib/skills/alignment-service.js';
import { FileSystemService } from '../lib/skills/fs-service.js';
import { Handlers } from './handlers.js';
import { Telemetry } from './telemetry.js';

// Initialize Services
const telemetry = new Telemetry();
const fsService = new FileSystemService(repoRoot);
const alignmentService = new AlignmentService(repoRoot); // Default to repoRoot, updated if clientRoot found
const kiService = new KiService();
const handlers = new Handlers(
  fsService,
  telemetry,
  alignmentService,
  kiService
);

// Resolve caller's project root once at startup (after dotenv has loaded)
// fsService.findProjectRoot skips the tech-lead-stack itself, returning null when cwd IS the server.
fsService
  .findProjectRoot(process.cwd())
  .then((clientRoot) => {
    fsService.setClientProjectRoot(clientRoot);
    if (clientRoot) {
      console.error(`[MCP] Resolved client project root: ${clientRoot}`);
      // Update AlignmentService to use client root for token storage
      const updatedAlignmentService = new AlignmentService(clientRoot);
      // We need to re-inject or update the service in handlers
      (handlers as any).alignmentService = updatedAlignmentService;
    } else {
      console.error(
        '[MCP] Running as standalone server - local skill lookup disabled.'
      );
    }
  })
  .catch(() => {
    // Non-fatal: server continues with only repo skills
    console.error(
      '[MCP] Client project root discovery failed - using repo skills only.'
    );
  });

const server = new Server(
  {
    name: 'tech-lead-stack-analytics',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
  }
);

/**
 * Allows the system to see a complete list of all the specialized workflows and skills available in the Tech-Lead Stack.
 * This is always the first step used to understand what capabilities the system has access to.
 */
const LIST_SKILLS_TOOL: Tool = {
  name: 'list_skills',
  description:
    'MANDATORY START: Lists ALL available Tech-Lead Stack architecture skills and workflows.',
  inputSchema: { type: 'object', properties: {} },
};

/**
 * Allows the system to read the instructions for one or more specific skills.
 * This teaches the system exactly how to perform a specialized task or workflow.
 */
const GET_SKILLS_TOOL: Tool = {
  name: 'get_skills',
  description: 'Reads the content of one or more skill markdown files.',
  inputSchema: {
    type: 'object',
    properties: {
      skillName: { type: 'string' },
      mode: {
        type: 'string',
        description: "'auto' | 'interview' (default 'interview')",
      },
      budget: {
        type: 'object',
        properties: {
          maxCostUsd: { type: 'number' },
          maxTotalTokens: { type: 'number' },
        },
      },
      projectName: { type: 'string' },
      model: { type: 'string' },
      agent: { type: 'string' },
      loopRunId: {
        type: 'string',
        description: 'Optional: ID of the loop run for tracking.',
      },
      teamRole: {
        type: 'string',
        description: 'Optional: Role of the team executing the skill.',
      },
      actorType: {
        type: 'string',
        description: 'Optional: Type of actor (AGENT or USER).',
      },
      autonomy: {
        type: 'string',
        description: 'Optional: Autonomy level (AUTONOMOUS or DIRECTED).',
      },
      loopPhase: {
        type: 'string',
        description: 'Optional: Phase of the loop.',
      },
      story: {
        type: 'string',
        description:
          'Direct user story input for standalone execution (materializes a spec).',
      },
      slice: {
        type: 'string',
        description:
          'Direct vertical slice input for standalone execution (materializes a slice-set).',
      },
    },
    required: ['skillName', 'projectName', 'model', 'agent'],
  },
};

/**
 * Allows the system to read the instructions for a single, specific skill.
 * Used as the primary way for the AI to learn how to execute a specific workflow (like 'planning-expert').
 */
const GET_SKILL_TOOL: Tool = {
  ...GET_SKILLS_TOOL,
  name: 'get_skill',
  description:
    "CORE EXECUTION: Reads a specific skill (e.g. 'planning-expert').",
};

/**
 * A critical safety and setup check. This tool ensures that the AI is following the project's rules
 * and has loaded the necessary instructions before it starts making any changes.
 */
const VERIFY_MISSION_ALIGNMENT_TOOL: Tool = {
  name: 'verify_mission_alignment',
  description:
    'MANDATORY PRE-FLIGHT: Validates that the agent is aligned with the operational boundaries and has initialized the required mission skills.',
  inputSchema: {
    type: 'object',
    properties: {
      agent: { type: 'string', description: 'Name of the agent' },
      projectName: {
        type: 'string',
        description: 'Name of the current project',
      },
    },
    required: ['agent', 'projectName'],
  },
};

/**
 * Allows the system to view a list of all saved "Knowledge Items" (KIs).
 * Knowledge Items are pieces of saved context, like project decisions or architecture notes,
 * helping the AI remember past work and important project details.
 */
const LIST_KI_TOOL: Tool = {
  name: 'list_knowledge_items',
  description: 'Lists all available Antigravity Knowledge Items.',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Optional: Filter by project name',
      },
    },
  },
};

/**
 * Allows the system to read the full contents of a specific Knowledge Item.
 * This helps the AI retrieve detailed, historical context about a specific topic or decision.
 */
const READ_KI_TOOL: Tool = {
  name: 'read_knowledge_item',
  description: 'Reads a specific Knowledge Item and its artifacts.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        description: 'The slug of the knowledge item to read',
      },
    },
    required: ['slug'],
  },
};

/**
 * Allows the system to save important new information as a Knowledge Item.
 * Whenever the AI learns something crucial or makes a key architectural decision,
 * it uses this tool to document it so it can be remembered later.
 */
const CREATE_KI_TOOL: Tool = {
  name: 'create_knowledge_item',
  description: 'Creates or updates a Knowledge Item from the current context.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        description: 'Unique slug (e.g., auth-migration-insights)',
      },
      summary: {
        type: 'string',
        description: 'Concise summary of the knowledge',
      },
      artifacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['name', 'content'],
        },
      },
      projectName: {
        type: 'string',
        description: 'Optional: Scoped project name',
      },
      references: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['slug', 'summary', 'artifacts'],
  },
};

/**
 * Allows the system to change the approval status of a Knowledge Item (e.g., from 'draft' to 'human-approved').
 * This is used to mark when a human has reviewed and signed off on important documentation.
 */
const APPROVE_KI_TOOL: Tool = {
  name: 'approve_knowledge_item',
  description: 'Sets the approval state of a Knowledge Item.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        description: 'The slug of the knowledge item to approve',
      },
      status: {
        type: 'string',
        enum: ['draft', 'human-approved', 'rejected'],
        description: 'The new approval status',
      },
      by: {
        type: 'string',
        description: 'Optional: Identifier for who approved/rejected it',
      },
    },
    required: ['slug', 'status'],
  },
};

/**
 * Allows the system to figure out the correct sequence of steps (the pipeline) needed to accomplish a task.
 * Based on what the user wants to do, this tool determines exactly which skills should be used and in what order.
 */
const PLAN_PIPELINE_TOOL: Tool = {
  name: 'plan_pipeline',
  description: 'Returns the ordered phase->skill chain for a task.',
  inputSchema: {
    type: 'object',
    properties: {
      intent: { type: 'string', description: 'The task intent' },
      targets: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target platforms or environments',
      },
      domain: { type: 'string', description: 'Domain context' },
    },
    required: ['intent'],
  },
};

/**
 * Triggers a powerful self-correction loop where two different AI models work together.
 * One AI creates a plan, and the other AI grades and critiques it. They bounce the plan back
 * and forth until it meets a high quality standard.
 */
const REFLEXION_LOOP_TOOL: Tool = {
  name: 'reflexion_loop',
  description:
    '✨ SPECIAL FEATURE: Self-correcting plan loop. Gemini drafts an implementation plan, Claude grades it 0-10 against the Four Pillars and returns one fix, repeat until it passes or caps. Requires GEMINI_API_KEY + ANTHROPIC_API_KEY.',
  inputSchema: {
    type: 'object',
    properties: {
      brief: {
        type: 'string',
        description: 'The feature brief / ticket to turn into a plan.',
      },
      stack: {
        type: 'string',
        description:
          'Optional Phase-0 stack context (e.g. package.json contents) for diagnosis-first planning.',
      },
      maxRevisions: {
        type: 'number',
        description: 'Hard cap on rewrites (default 3).',
      },
      passThreshold: {
        type: 'number',
        description: 'Critic score 0-10 needed to pass early (default 8).',
      },
      projectName: {
        type: 'string',
        description: 'Optional project name, for usage analytics.',
      },
      agent: {
        type: 'string',
        description: 'Optional calling agent name, for usage analytics.',
      },
      sizeScore: {
        type: 'number',
        description: '0-10 score for task size',
      },
      riskSignals: {
        type: 'array',
        items: { type: 'string' },
        description: 'Risk signals identified in the brief',
      },
    },
    required: ['brief'],
  },
};

/**
 * A version of the self-correction loop specifically configured for the $100/month subscription tier.
 * It hardens and tests the plan to ensure it meets strict quality standards.
 */
const REFLEXION_LOOP_SUB_MAX_TOOL: Tool = {
  ...REFLEXION_LOOP_TOOL,
  name: 'reflexion_loop_sub_max',
  description: '[DEV-TEAM · SUB-MAX] Plan hardening for $100/mo tier.',
};

/**
 * A version of the self-correction loop specifically configured for the $20/month subscription tier.
 * It hardens and tests the plan to ensure it meets strict quality standards.
 */
const REFLEXION_LOOP_SUB_PRO_TOOL: Tool = {
  ...REFLEXION_LOOP_TOOL,
  name: 'reflexion_loop_sub_pro',
  description: '[DEV-TEAM · SUB-PRO] Plan hardening for $20/mo tier.',
};

/**
 * Allows the system to pick up and continue a self-correction loop that was paused.
 * This is useful if the system was waiting for human input or was temporarily stopped.
 */
const REFLEXION_RESUME_TOOL: Tool = {
  name: 'reflexion_resume',
  description: 'Resumes a parked Reflexion Loop.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      stateDir: { type: 'string' },
      answers: { type: 'object' },
    },
    required: ['runId', 'answers'],
  },
};

/**
 * Allows the system to check in on a self-correction loop that is running in the background,
 * retrieving its current progress and state.
 */
const REFLEXION_STATUS_TOOL: Tool = {
  name: 'reflexion_status',
  description: 'Checks the status of an asynchronous Reflexion Loop run.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      stateDir: {
        type: 'string',
        description:
          'Optional: Directory where state is stored (defaults to .reflexion-out)',
      },
    },
    required: ['runId'],
  },
};

/**
 * Allows the system to view a high-level map of all the files in the codebase
 * and see the main components (like functions and classes) inside each file.
 * This is useful for quickly understanding the overall architecture of the project.
 */
const REPO_MAP_TOOL: Tool = {
  name: 'repo_map',
  description:
    'Retrieves a compact map of the repository files and top-level symbol signatures.',
  inputSchema: {
    type: 'object',
    properties: {
      tokenBudget: {
        type: 'number',
        description: 'Optional budget to trim the map size.',
      },
    },
  },
};

/**
 * Allows the system to search through the entire codebase using natural language.
 * Instead of looking for exact words, it understands the meaning of the search query
 * and finds the most relevant pieces of code.
 */
const CODE_SEARCH_TOOL: Tool = {
  name: 'code_search',
  description:
    'Semantic search across the repository code using local embeddings.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query or keyword.' },
      k: {
        type: 'number',
        description: 'Optional number of top results to return (default 5).',
      },
    },
    required: ['query'],
  },
};

/**
 * Allows the system to look at a specific, targeted section of a file (by providing start and end line numbers).
 * This prevents the system from having to read massive files all at once when it only needs to see a small part.
 */
const READ_REGION_TOOL: Tool = {
  name: 'read_region',
  description: 'Reads a specific line range from a file.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path to the file.' },
      startLine: { type: 'number', description: '1-indexed starting line.' },
      endLine: { type: 'number', description: '1-indexed ending line.' },
    },
    required: ['path', 'startLine', 'endLine'],
  },
};

/**
 * Allows the system to edit a file by looking for a specific chunk of existing code and replacing it with new code.
 * This is significantly faster and more reliable than rewriting the entire file from scratch just to make a small change.
 */
const APPLY_PATCH_TOOL: Tool = {
  name: 'apply_patch',
  description:
    'Applies minimal SEARCH/REPLACE blocks to a file instead of rewriting it completely.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path to the file.' },
      patch: { type: 'string', description: 'The SEARCH/REPLACE blocks.' },
    },
    required: ['path', 'patch'],
  },
};

/**
 * Handlers: Tool Listing
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      LIST_SKILLS_TOOL,
      GET_SKILLS_TOOL,
      GET_SKILL_TOOL,
      VERIFY_MISSION_ALIGNMENT_TOOL,
      LIST_KI_TOOL,
      READ_KI_TOOL,
      CREATE_KI_TOOL,
      APPROVE_KI_TOOL,
      PLAN_PIPELINE_TOOL,
      REFLEXION_LOOP_TOOL,
      REFLEXION_LOOP_SUB_MAX_TOOL,
      REFLEXION_LOOP_SUB_PRO_TOOL,
      REFLEXION_RESUME_TOOL,
      REFLEXION_STATUS_TOOL,
      REPO_MAP_TOOL,
      CODE_SEARCH_TOOL,
      READ_REGION_TOOL,
      APPLY_PATCH_TOOL,
    ],
  };
});

/**
 * Handlers: Tool Execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const hookCheck = await handlers.evaluateHooks(name, args || {});
  if (!hookCheck.allowed && hookCheck.refusalPayload) {
    return hookCheck.refusalPayload;
  }

  if (name === 'list_skills') {
    return await handlers.handleListSkills();
  }

  if (
    name === 'get_skills' ||
    name === 'get_skill' ||
    name.startsWith('get_')
  ) {
    return await handlers.handleGetSkill(name, args || {});
  }

  if (name === 'verify_mission_alignment') {
    return await handlers.handleVerifyMissionAlignment(args || {});
  }

  if (name === 'list_knowledge_items') {
    return await handlers.handleListKnowledgeItems(args || {});
  }

  if (name === 'read_knowledge_item') {
    return await handlers.handleReadKnowledgeItem(args || {});
  }

  if (name === 'create_knowledge_item') {
    return await handlers.handleCreateKnowledgeItem(args || {});
  }

  if (name === 'approve_knowledge_item') {
    return await handlers.handleApproveKnowledgeItem(args || {});
  }

  if (name === 'plan_pipeline') {
    return await handlers.handlePlanPipeline(args || {});
  }

  if (name === 'reflexion_loop') {
    return await handlers.handleReflexionLoop(args || {});
  }

  if (name === 'reflexion_loop_sub_max') {
    return await handlers.handleReflexionLoop({
      ...(args || {}),
      tier: 'sub-max',
    });
  }

  if (name === 'reflexion_loop_sub_pro') {
    return await handlers.handleReflexionLoop({
      ...(args || {}),
      tier: 'sub-pro',
    });
  }

  if (name === 'reflexion_resume') {
    return await handlers.handleReflexionResume(args || {});
  }

  if (name === 'reflexion_status') {
    return await handlers.handleReflexionStatus(args || {});
  }

  if (name === 'repo_map') {
    return await handlers.handleRepoMap(args || {});
  }

  if (name === 'code_search') {
    return await handlers.handleCodeSearch(args || {});
  }

  if (name === 'read_region') {
    return await handlers.handleReadRegion(args || {});
  }

  if (name === 'apply_patch') {
    return await handlers.handleApplyPatch(args || {});
  }

  throw new Error(`Unknown tool: ${name}`);
});

/**
 * Server Lifecycle
 */
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Release stdout back to MCP SDK — intercept no longer needed
  mcpTransportConnected = true;
  console.error('Tech-Lead Stack Analytics MCP Server running on stdio');
}

runServer().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Fatal error running MCP server:', errorMessage);
  process.exit(1);
});

process.on('SIGINT', () => {
  langfuseSink.shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  langfuseSink.shutdown();
  process.exit(0);
});
