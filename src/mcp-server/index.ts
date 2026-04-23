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

import { FileSystemService } from '../lib/skills/fs-service.js';
import { Handlers } from './handlers.js';
import { Telemetry } from './telemetry.js';

// Initialize Services
const telemetry = new Telemetry();
const fsService = new FileSystemService(repoRoot);
const handlers = new Handlers(fsService, telemetry);

// Resolve caller's project root once at startup (after dotenv has loaded)
// fsService.findProjectRoot skips the tech-lead-stack itself, returning null when cwd IS the server.
fsService
  .findProjectRoot(process.cwd())
  .then((clientRoot) => {
    fsService.setClientProjectRoot(clientRoot);
    if (clientRoot) {
      console.error(`[MCP] Resolved client project root: ${clientRoot}`);
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

/**
 * Handlers: Tool Listing
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const skills = await fsService.getDynamicSkills();
  const skillToToolName = (skill: string) => `get_${skill.replace(/-/g, '_')}`;

  const dynamicTools: Tool[] = Array.from(skills.entries())
    .filter(([, meta]) => !meta.internal)
    .map(([name, meta]) => ({
      name: skillToToolName(name),
      description: `[SKILL] ${meta.description} (Standard Cost: ${meta.cost})`,
      inputSchema: GET_SKILLS_TOOL.inputSchema,
    }));

  return {
    tools: [LIST_SKILLS_TOOL, GET_SKILLS_TOOL, GET_SKILL_TOOL, ...dynamicTools],
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
