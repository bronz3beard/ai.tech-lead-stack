import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Handlers } from "../handlers";
import { FileSystemService } from "../fs-service";
import { Telemetry } from "../telemetry";
import * as path from "path";

// Mock the services
jest.mock("../fs-service");
jest.mock("../telemetry");

describe("MCP Server", () => {
  let handlers: Handlers;
  let mockFsService: jest.Mocked<FileSystemService>;
  let mockTelemetry: jest.Mocked<Telemetry>;

  beforeEach(() => {
    mockFsService = new FileSystemService("mock-root") as jest.Mocked<FileSystemService>;
    mockTelemetry = new Telemetry() as jest.Mocked<Telemetry>;

    // Default mock implementations
    mockFsService.getSearchDirs.mockReturnValue(["mock-dir-1", "mock-dir-2"]);

    // We mock readSkill to return a default file payload for success paths
    mockFsService.readSkill.mockImplementation(async (skillName) => {
        if (skillName === "test-skill") {
            return {
                content: "Skill Content",
                path: "mock/path.md"
            };
        }
        return undefined; // Not found
    });

    mockTelemetry.withAnalytics.mockImplementation(async (name, project, model, agent, cost, callback) => {
      return await callback();
    });

    handlers = new Handlers(mockFsService, mockTelemetry);
  });

  describe("CallToolRequestSchema handler - get_skills / get_skill", () => {
    it("should successfully read a skill file from the first directory", async () => {
      const result = await handlers.handleGetSkill("get_skill", {
        skillName: "test-skill",
        projectName: "test-project",
        model: "gpt-4",
        agent: "test-agent"
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("Skill Content");

      expect(mockTelemetry.withAnalytics).toHaveBeenCalledWith(
        "test-skill",
        "test-project",
        "gpt-4",
        "test-agent",
        "unknown",
        expect.any(Function)
      );
    });

    it("should return an error if skill is not found", async () => {
      const result = await handlers.handleGetSkill("get_skill", {
        skillName: "non-existent",
        projectName: "test-project",
        model: "gpt-4",
        agent: "test-agent"
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error: Skill file \"non-existent\" not found.");
    });

    it("should fallback to extracting project name from package.json if omitted", async () => {
       // Force fallback branch by omitting projectName
       mockFsService.findProjectRoot.mockResolvedValue("/mock/app");

       // In handlers.ts, if fs.readFile throws, it falls back to path.basename
       // Since we didn't mock fs.readFile here, it will throw and fallback to "app"

       const result = await handlers.handleGetSkill("get_skill", {
         skillName: "test-skill"
       });

       expect(result.isError).toBe(false);
       expect(mockTelemetry.withAnalytics).toHaveBeenCalledWith(
         "test-skill",
         "app",
         undefined,
         undefined,
         "unknown",
         expect.any(Function)
       );
    });
  });
});
