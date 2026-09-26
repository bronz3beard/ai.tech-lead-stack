# Architecture

[← Back to the README](../README.md)

## 🛠 Technical Architecture: RTK & MCP Synergy

To maintain high performance and auditability, the Tech-Lead Stack uses a
dual-layered architecture:

### 1. The Human-CLI Registry (`package.json`)

The `rtk.tools` section in `package.json` acts as the **Single Source of Truth**
for tool execution.

- **The Human Side**: When you run `rtk run <tool>`, the
  [rtk-run.sh](../scripts/rtk-run.sh) script specifically looks for that key in
  your local (or linked) `package.json`.
- **The Synergy**: This ensures that even if you aren't using an AI agent, you
  can manually audit or trigger any skill logic via the terminal. It guarantees
  that the Agent and the Human are always working from the same operational
  registry.

### 2. The Agent-Knowledge Broker (MCP Server)

The **MCP Server** serves as the **Intelligence Layer** for your IDE.

- **Skill Discovery**: The server dynamically reads `.ai/skills/*.md` files and
  exposes them as tools. It uses the `internal: true` flag to hide support-only
  skills from primary discovery while keeping them available for implementation.
- **Telemetry & Metrics**: Unlike the CLI, executions via the MCP are
  instrumented via **Langfuse**. This captures token usage, project attribution,
  and agentic decision-making for enterprise-grade analytics.

### 3. Agent Skills vs. Dev Workflows

| Category          | Storage              | Purpose                                                                                   |
| :---------------- | :------------------- | :---------------------------------------------------------------------------------------- |
| **Agent Skills**  | `.ai/skills/`        | **Core Brains**: High-density instructions for the AI. Some are "Internal" support logic. |
| **Dev Workflows** | `.agents/workflows/` | **User Orchestrations**: Antigravity `/slash` commands or manual starting prompts.        |

## 🛠 Technical Overview: Skill Discovery & Priority

To maintain **User Sovereignty** and ensure **Context Hygiene**, the Tech-Lead
Stack does not simply read static files. Access to all skills is brokered
through the **MCP Server**, which enforces a strict priority of discovery:

1.  **Project-Local Override**: `.ai/skills/` in your current working directory.
2.  **Global Fallback**: `.ai/skills/` in the `tech-lead-stack` repository.

### Why Go Through the MCP?

- **Customization**: Teams can "fork" a skill for a specific project without
  modifying the global repository.
- **Auditability**: Every skill retrieval is wrapped in a **Langfuse Trace**
  (Telemetry) to track which model, agent, and project are executing specific
  logic.
- **Cost Control**: The server captures and reports the "Budgeted Cost" of each
  skill to prevent uncontrolled LLM spend.

### Priority Logic Snippet:

```typescript
// src/lib/skills/fs-service.ts

async readSkill(safeSkillName: string) {
  // Define Search Paths: Local Project has priority over Global Repo
  const localSkillsDir = path.join(process.cwd(), ".ai/skills");
  const searchDirs = [localSkillsDir, this.repoSkillsDir];

  for (const dir of searchDirs) {
    const skillPath = path.join(dir, `${safeSkillName}.md`);
    try {
      // Returns the first match found (Local Override logic)
      const content = await fs.readFile(skillPath, "utf-8");
      return { content, path: skillPath };
    } catch {
      // Continue to Fallback
    }
  }
}
```
