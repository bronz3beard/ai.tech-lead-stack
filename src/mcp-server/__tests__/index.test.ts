/* eslint-disable @typescript-eslint/no-require-imports */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as fs from "fs/promises";
import { isSkillTrace } from "../../lib/trace-utils.js";

// Mock dependencies
jest.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      setRequestHandler: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

jest.mock("@modelcontextprotocol/sdk/server/stdio.js", () => {
  return {
    StdioServerTransport: jest.fn().mockImplementation(() => ({})),
  };
});

jest.mock("fs/promises", () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock("../../lib/trace-utils.js", () => ({
  isSkillTrace: jest.fn(),
}));

const mockWithAnalytics = jest.fn().mockImplementation(
  async (_skill, _proj, _mod, _agt, cb) => await cb()
);

jest.mock("../telemetry.js", () => {
  return {
    Telemetry: jest.fn().mockImplementation(() => ({
      withAnalytics: mockWithAnalytics,
    })),
  };
});

describe("MCP Server", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listToolsHandler: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let callToolHandler: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockServer: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Force a fresh require to register handlers
    jest.isolateModules(() => {
      require("../index.ts");
      mockServer = (Server as jest.Mock).mock.results[0].value;

      // Extract handlers
      const calls = mockServer.setRequestHandler.mock.calls;
      for (const call of calls) {
        // Find handlers based on the ZodSchema shapes or schema names
        const schemaShapeStr = JSON.stringify(call[0]);
        if (schemaShapeStr.includes('tools/list')) {
          listToolsHandler = call[1];
        } else if (schemaShapeStr.includes('tools/call')) {
          callToolHandler = call[1];
        }
      }
    });
  });

  it("should setup successfully", () => {
    expect(Server).toHaveBeenCalled();
    // Validate we got the handlers, exact match with zod schema is tricky in jest so we just check they were found
    expect(listToolsHandler).toBeDefined();
    expect(callToolHandler).toBeDefined();
    expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
  });

  describe("ListToolsRequestSchema handler", () => {
    it("should return the correct list of tools", async () => {
      const result = await listToolsHandler();
      expect(result.tools).toHaveLength(3);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain("list_skills");
      expect(toolNames).toContain("get_skills");
      expect(toolNames).toContain("get_skill");
    });
  });

  describe("CallToolRequestSchema handler - get_skills / get_skill", () => {
    beforeEach(() => {
      (isSkillTrace as jest.Mock).mockReturnValue(false);
      mockWithAnalytics.mockClear();
    });

    it("should successfully read a skill file from the first directory", async () => {
      // Setup
      (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
        if (filePath.includes("package.json")) return JSON.stringify({ name: "my-project" });
        return "Skill Content";
      });

      const result = await callToolHandler({
        params: {
          name: "get_skills",
          arguments: { skillName: "test-skill", projectName: "test-project", model: "gpt-4", agent: "test-agent" }
        }
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("Skill Content");

      expect(mockWithAnalytics).toHaveBeenCalledWith(
        "test-skill",
        "test-project",
        "gpt-4",
        "test-agent",
        expect.any(Function)
      );
    });

    it("should fallback to extracting project name from package.json if omitted", async () => {
      (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
        if (filePath.includes("package.json")) return JSON.stringify({ name: "fallback-project" });
        return "Fallback Content";
      });

      const result = await callToolHandler({
        params: {
          name: "get_skill",
          arguments: { skillName: "test-skill" }
        }
      });

      expect(result.isError).toBe(false);
      expect(mockWithAnalytics).toHaveBeenCalledWith(
        "test-skill",
        "fallback-project",
        undefined,
        undefined,
        expect.any(Function)
      );
    });

    it("should skip telemetry if isSkillTrace is true", async () => {
      (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
        if (filePath.includes("package.json")) return JSON.stringify({ name: "my-project" });
        return "Secret Skill Content";
      });
      (isSkillTrace as jest.Mock).mockReturnValue(true);

      const result = await callToolHandler({
        params: { name: "get_skill", arguments: { skillName: "SKILL" } }
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("Secret Skill Content");
      expect(mockWithAnalytics).not.toHaveBeenCalled();
    });

    it("should return error if skill file is not found anywhere", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("File not found"));

      const result = await callToolHandler({
        params: { name: "get_skills", arguments: { skillName: "missing-skill" } }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Skill file \"missing-skill\" not found");
      expect(mockWithAnalytics).not.toHaveBeenCalled();
    });

    it("should fallback to reading from second directory if first fails", async () => {
      let readCount = 0;
      (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
        if (filePath.includes("package.json")) return JSON.stringify({ name: "my-project" });
        readCount++;
        if (readCount === 1) throw new Error("Not found locally");
        return "Repo Skill Content";
      });

      const result = await callToolHandler({
        params: { name: "get_skill", arguments: { skillName: "fallback-skill" } }
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("Repo Skill Content");
    });
  });

  describe("CallToolRequestSchema handler - unknown tool", () => {
    it("should throw an error for unknown tool", async () => {
      await expect(callToolHandler({ params: { name: "unknown_tool" } }))
        .rejects
        .toThrow("Unknown tool: unknown_tool");
    });
  });

  describe("CallToolRequestSchema handler - list_skills", () => {
    beforeEach(() => {
      (isSkillTrace as jest.Mock).mockReturnValue(false);
    });

    it("should list skills from both directories and sort them", async () => {
      // Mock readdir to return different files for different directories.
      // Since the test environment is inside `/app` which is the repo root, process.cwd() is `/app` and __dirname is `/app/src/mcp-server`.
      // The searchDirs will be [`/app/.ai/skills`, `/app/.ai/skills`] because `localSkillsDir` and `repoSkillsDir` resolve to the same path here!
      // So we will just resolve based on whether it's the first or second call to simulate.
      let callCount = 0;
      (fs.readdir as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
           return ["local-skill.md", "shared-skill.md"];
        }
        return ["repo-skill.md", "shared-skill.md", "not-a-skill.txt"];
      });

      const result = await callToolHandler({ params: { name: "list_skills" } });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);

      const text = result.content[0].text;
      expect(text).toContain("Available skills");
      expect(text).toContain("- local-skill");
      expect(text).toContain("- repo-skill");
      expect(text).toContain("- shared-skill");
      expect(text).not.toContain("- not-a-skill");

      // Check alphabetical sorting
      const lines = text.split("\n").filter((l: string) => l.startsWith("- "));
      expect(lines).toEqual([
        "- local-skill",
        "- repo-skill",
        "- shared-skill"
      ]);
    });

    it("should handle error when readdir fails for both directories", async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error("Dir not found"));

      const result = await callToolHandler({ params: { name: "list_skills" } });

      // Still returns isError: false because we catch and silently ignore missing directories in list_skills,
      // but it will just be an empty list. Wait, let's verify if the handler catches everything correctly.
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("Available skills");
      // No skills listed
      const lines = result.content[0].text.split("\n").filter((l: string) => l.startsWith("- "));
      expect(lines).toHaveLength(0);
    });

    it("should filter out skills where isSkillTrace returns true", async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(["real-skill.md", "SKILL.md"]);

      // Mock isSkillTrace to return true only for SKILL
      (isSkillTrace as jest.Mock).mockImplementation((_name, skillName) => skillName === "SKILL");

      const result = await callToolHandler({ params: { name: "list_skills" } });

      const text = result.content[0].text;
      expect(text).toContain("- real-skill");
      expect(text).not.toContain("- SKILL");
    });
  });
});
