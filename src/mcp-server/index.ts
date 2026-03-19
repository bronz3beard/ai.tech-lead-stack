#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { Telemetry } from "./telemetry.js";
import "dotenv/config";

const telemetry = new Telemetry();

const server = new Server(
  {
    name: "tech-lead-stack-analytics",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const GET_SKILL_TOOL: Tool = {
  name: "get_skill",
  description: "Reads the content of a skill markdown file from the .ai/skills directory and logs its usage to Langfuse telemetry.",
  inputSchema: {
    type: "object",
    properties: {
      skillName: {
        type: "string",
        description: "The name of the skill (without the .md extension), e.g., 'planning-expert'.",
      },
      projectId: {
        type: "string",
        description: "The name or path of the symlinked project where the agent is currently operating. Used for telemetry tracking.",
      },
    },
    required: ["skillName"],
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [GET_SKILL_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  if (request.params.name !== "get_skill") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const { skillName, projectId } = request.params.arguments as {
    skillName: string;
    projectId?: string;
  };

  // Prevent path traversal
  const safeSkillName = path.basename(skillName, ".md");
  const skillPath = path.join(process.cwd(), ".ai", "skills", `${safeSkillName}.md`);

  try {
    const fileContent = await telemetry.withAnalytics(
      safeSkillName,
      projectId,
      async () => {
        return await fs.readFile(skillPath, "utf-8");
      }
    );

    return {
      content: [
        {
          type: "text",
          text: fileContent,
        },
      ],
      isError: false,
    };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return {
        content: [
          {
            type: "text",
            text: `Error: Skill file not found: ${skillPath}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Error reading skill: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tech-Lead Stack Analytics MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running MCP server:", error);
  process.exit(1);
});
