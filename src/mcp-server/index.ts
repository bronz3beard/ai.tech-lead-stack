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
 * Tool Definitions
 */
const LIST_SKILLS_TOOL: Tool = {
  name: 'list_skills',
  description:
    'MANDATORY START: Lists ALL available Tech-Lead Stack architecture skills and workflows.',
  inputSchema: { type: 'object', properties: {} },
};

const GET_SKILLS_TOOL: Tool = {
  name: 'get_skills',
  description: 'Reads the content of one or more skill markdown files.',
  inputSchema: {
    type: 'object',
    properties: {
      skillName: { type: 'string' },
      mode: { type: 'string', description: "'auto' | 'interview' (default 'interview')" },
      budget: { type: 'object', properties: { maxCostUsd: { type: 'number' }, maxTotalTokens: { type: 'number' } } },
      projectName: { type: 'string' },
      model: { type: 'string' },
      agent: { type: 'string' },
    },
    required: ['skillName', 'projectName', 'model', 'agent'],
  },
};

const GET_SKILL_TOOL: Tool = {
  ...GET_SKILLS_TOOL,
  name: 'get_skill',
  description:
    "CORE EXECUTION: Reads a specific skill (e.g. 'planning-expert').",
};

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
      maxRevisions: { type: 'number', description: 'Hard cap on rewrites (default 3).' },
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
    },
    required: ['brief'],
  },
};


const REFLEXION_RESUME_TOOL: Tool = {
  name: 'reflexion_resume',
  description: 'Resumes a parked Reflexion Loop.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      stateDir: { type: 'string' },
      answers: { type: 'object' }
    },
    required: ['runId', 'answers']
  }
};

const REFLEXION_STATUS_TOOL: Tool = {
  name: 'reflexion_status',
  description: 'Checks the status of an asynchronous Reflexion Loop run.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      stateDir: { type: 'string', description: 'Optional: Directory where state is stored (defaults to .reflexion-out)' },
    },
    required: ['runId']
  }
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
      REFLEXION_LOOP_TOOL,
      REFLEXION_RESUME_TOOL,
      REFLEXION_STATUS_TOOL,
    ],
  };
});

/**
 * Handlers: Tool Execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

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

  if (name === 'reflexion_loop') {
    return await handlers.handleReflexionLoop(args || {});
  }

  if (name === 'reflexion_resume') {
    return await handlers.handleReflexionResume(args || {});
  }

  if (name === 'reflexion_status') {
    return await handlers.handleReflexionStatus(args || {});
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
