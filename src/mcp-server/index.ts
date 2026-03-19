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

const repoSkillsDir = path.resolve(__dirname, "../../.ai/skills");

const LIST_SKILLS_TOOL: Tool = {
  name: "list_skills",
  description: "Lists all available architectural skills and workflows. Checks both the project-local .ai/skills and the tech-lead-stack source repository.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const GET_SKILLS_TOOL: Tool = {
  name: "get_skills",
  description: "Reads the content of one or more skill markdown files. Checks project-local .ai/skills first, then falls back to the tech-lead-stack source repository.",
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

const GET_SKILL_TOOL: Tool = {
  ...GET_SKILLS_TOOL,
  name: "get_skill",
  description: "Alias for get_skills. Reads the content of a skill markdown file.",
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LIST_SKILLS_TOOL, GET_SKILLS_TOOL, GET_SKILL_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
  const { name, arguments: args } = request.params;

  // Resolve directories
  const localSkillsDir = path.join(process.cwd(), ".ai", "skills");
  const searchDirs = [localSkillsDir, repoSkillsDir];

  if (name === "list_skills") {
    try {
      const allSkills = new Set<string>();
      
      for (const dir of searchDirs) {
        try {
          const files = await fs.readdir(dir);
          files
            .filter(file => file.endsWith(".md"))
            .forEach(file => allSkills.add(path.basename(file, ".md")));
        } catch {
          // Skip if directory doesn't exist
        }
      }
      
      const skillFiles = Array.from(allSkills).sort();
      
      return {
        content: [
          {
            type: "text",
            text: `Available skills (found in ${searchDirs.join(", ")}):\n${skillFiles.map(s => `- ${s}`).join("\n")}`,
          },
        ],
        isError: false,
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing skills: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "get_skills" || name === "get_skill") {
    const { skillName, projectId } = args as {
      skillName: string;
      projectId?: string;
    };

    const safeSkillName = path.basename(skillName, ".md");
    let content: string | null = null;
    let usedPath: string | null = null;

    for (const dir of searchDirs) {
      const skillPath = path.join(dir, `${safeSkillName}.md`);
      try {
        content = await fs.readFile(skillPath, "utf-8");
        usedPath = skillPath;
        break; // Found it!
      } catch {
        // Continue to fallback
      }
    }

    if (content && usedPath) {
      try {
        const fileContent = await telemetry.withAnalytics(
          safeSkillName,
          projectId,
          async () => content!
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
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Error processing skill analytics: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Error: Skill file "${safeSkillName}" not found in any of: ${searchDirs.join(", ")}. Use list_skills to see available skills.`,
        },
      ],
      isError: true,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

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
