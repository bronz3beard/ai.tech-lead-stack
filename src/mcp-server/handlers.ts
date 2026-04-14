import { FileSystemService } from "../lib/skills/fs-service.js";
import { Telemetry } from "./telemetry.js";
import { isSkillTrace } from "../lib/trace-utils.js";
import * as path from "path";
import * as fs from "fs/promises";

/**
 * Handlers manages the execution logic for all MCP tools.
 * Enforces SRP by separating request handling from server configuration.
 */
export class Handlers {
  constructor(
    private fsService: FileSystemService,
    private telemetry: Telemetry
  ) {}

  /**
   * Logic for the 'list_skills' tool.
   */
  async handleListSkills() {
    const searchDirs = this.fsService.getSearchDirs();
    const allSkills = new Set<string>();

    await Promise.all(
      searchDirs.map(async (dir) => {
        try {
          const files = await fs.readdir(dir);
          files
            .filter(file => file.endsWith(".md"))
            .forEach(file => allSkills.add(path.basename(file, ".md")));
        } catch { /* skip directory if missing */ }
      })
    );

    const skillFiles = Array.from(allSkills)
      .filter(skill => !isSkillTrace(undefined, skill))
      .sort();

    return {
      content: [
        {
          type: "text",
          text: `Available skills (found in ${searchDirs.join(", ")}):\n${skillFiles.map(s => `- ${s}`).join("\n")}`,
        },
      ],
      isError: false,
    };
  }

  /**
   * Logic for 'get_skills' and 'get_skill' tools (and dynamic tool aliases).
   */
  async handleGetSkill(name: string, args: Record<string, unknown>) {
    const skillName = args.skillName as string | undefined;
    const projectName = args.projectName as string | undefined;
    const model = args.model as string | undefined;
    const agent = args.agent as string | undefined;

    // Normalize tool name to skill filename
    const isDiscreteTool = name.startsWith("get_") && name !== "get_skill" && name !== "get_skills";
    
    // Reverse map: "get_planning_expert" -> "planning-expert"
    const toolToSkillName = (tool: string) => tool.replace(/^get_/, "").replace(/_/g, "-");
    
    const effectiveSkillName = isDiscreteTool ? toolToSkillName(name) : path.basename(skillName || "unknown", ".md");
    const safeSkillName = path.basename(effectiveSkillName, ".md");

    const skill = await this.fsService.readSkill(safeSkillName);

    if (skill) {
      const { content: rawContent } = skill;
      let actualProjectName = projectName;

      // Robust detection pipeline via FileSystemService
      if (!actualProjectName || 
          actualProjectName.toLowerCase() === 'unknown' || 
          actualProjectName === '.' || 
          actualProjectName === 'tech-lead-stack') {
         
         const projectRoot = await this.fsService.findProjectRoot(/*turbopackIgnore: true*/ process.cwd());
         if (projectRoot) {
            try {
              const packagePath = path.join(projectRoot, "package.json");
              const pkg = JSON.parse(await fs.readFile(packagePath, "utf-8"));
              if (pkg.name && !pkg.name.includes("tech-lead-stack")) {
                actualProjectName = pkg.name;
              } else {
                actualProjectName = path.basename(projectRoot);
              }
            } catch {
              actualProjectName = path.basename(projectRoot);
            }
         } else {
            // If still unknown, use the current folder name but try to extract meaningful context
            const cwd = /*turbopackIgnore: true*/ process.cwd();
            actualProjectName = path.basename(cwd) === 'tech-lead-stack' 
              ? 'tech-lead-stack-internal' 
              : path.basename(cwd);
         }
      } else {
        // If projectName is provided, try to find its root to ensure we are in the right place
        const projectRoot = await this.fsService.findProjectRoot(/*turbopackIgnore: true*/ process.cwd());
        if (projectRoot) {
          try {
            const packagePath = path.join(projectRoot, "package.json");
            const pkg = JSON.parse(await fs.readFile(packagePath, "utf-8"));
            // If the package name doesn't match the passed projectName, we might be misaligned
            if (pkg.name !== actualProjectName && !actualProjectName.includes(pkg.name)) {
               console.warn(`Project name mismatch: expected ${actualProjectName}, found ${pkg.name} at ${projectRoot}`);
            }
          } catch {
            // fallback
          }
        }
      }

      const shouldSkipAnalytics = isSkillTrace(undefined, safeSkillName);
      
      let skillCost = "unknown";
      const metaMatch = rawContent.match(/cost:\s*(.*)/);
      if (metaMatch) skillCost = metaMatch[1].trim();

      const fileContent = shouldSkipAnalytics 
        ? rawContent
        : await this.telemetry.withAnalytics(
            safeSkillName,
            actualProjectName,
            model,
            agent,
            skillCost,
            async () => rawContent
          );

      return {
        content: [{ type: "text", text: fileContent }],
        isError: false,
      };
    }

    return {
      content: [{ 
        type: "text", 
        text: `Error: Skill file "${safeSkillName}" not found. Use list_skills to see available skills.` 
      }],
      isError: true,
    };
  }
}
