#!/usr/bin/env node

/**
 * Tech-Lead Stack MCP Server
 * 
 * Refactored to follow SOLID principles (SRP, OCP, DIP).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import * as dotenv from "dotenv";

const repoRoot = path.resolve(/*turbopackIgnore: true*/ __dirname, "../../");
const originalConsoleLog = console.log;
console.log = () => {}; // Suppress dotenv tip that breaks MCP stdio JSON parsing
dotenv.config({ path: path.join(repoRoot, ".env") });
console.log = originalConsoleLog;

import { Telemetry } from "./telemetry.js";
import { FileSystemService } from "../lib/skills/fs-service.js";
import { Handlers } from "./handlers.js";

// Initialize Services
const telemetry = new Telemetry();
const fsService = new FileSystemService(repoRoot);
const handlers = new Handlers(fsService, telemetry);

const server = new Server(
  {
    name: "tech-lead-stack-analytics",
    version: "1.0.0",
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
  name: "list_skills",
  description: "MANDATORY START: Lists ALL available Tech-Lead Stack architecture skills and workflows.",
  inputSchema: { type: "object", properties: {} },
};

const GET_SKILLS_TOOL: Tool = {
  name: "get_skills",
  description: "Reads the content of one or more skill markdown files.",
  inputSchema: {
    type: "object",
    properties: {
      skillName: { type: "string" },
      projectName: { type: "string" },
      model: { type: "string" },
      agent: { type: "string" },
    },
    required: ["skillName", "projectName", "model", "agent"],
  },
};

const GET_SKILL_TOOL: Tool = {
  ...GET_SKILLS_TOOL,
  name: "get_skill",
  description: "CORE EXECUTION: Reads a specific skill (e.g. 'planning-expert').",
};

/**
 * Handlers: Tool Listing
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const skills = await fsService.getDynamicSkills();
  const skillToToolName = (skill: string) => `get_${skill.replace(/-/g, "_")}`;

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

  if (name === "list_skills") {
    return await handlers.handleListSkills();
  }

  if (name === "get_skills" || name === "get_skill" || name.startsWith("get_")) {
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
  console.error("Tech-Lead Stack Analytics MCP Server running on stdio");
}

runServer().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("Fatal error running MCP server:", errorMessage);
  process.exit(1);
});
