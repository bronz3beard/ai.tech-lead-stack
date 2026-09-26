# Antigravity Setup

[← Back to the README](../../README.md)

## Step 1: Clone the Repository

Open your terminal and clone the `tech-lead-stack` repository to a permanent
location on your machine.

```bash
git clone https://github.com/your-username/tech-lead-stack.git ~/tech-lead-stack
cd ~/tech-lead-stack
```

## Step 2: Run the Installer

Run the `install.sh` script to set up dependencies and link the stack to your
current working directory.

```bash
./install.sh --link .
```

_Note: This will also output a JSON snippet for MCP configuration. Keep this
handy for Step 6._

**Updating an Existing Installation:** If you already use the `tech-lead-stack`
in your projects and are pulling the latest updates, you don't need to re-run
`install.sh` in every project. Just run the following in the `tech-lead-stack`
root directory to update the MCP server bundle:

```bash
pnpm install
pnpm run mcp:build
```

## Step 3: Access Antigravity Customizations

Open the **Agent** panel in Antigravity. Click the **"Open Agent Manager"**
button at the top to find the **Customizations** menu.

## Step 4: Navigate to Workflows

In the Customizations panel, select the **Workflows** tab.

## Step 5: Register Global Workflows

To make workflows available across all projects:

1. Click the **+ Global** button.
2. Open any workflow file from `.agents/workflows/` in your IDE (e.g.,
   `audit-tech-debt.md`).
3. Copy the entire content of the markdown file.
4. Paste it into the Antigravity workflow editor.
5. Give it a name (e.g., `audit-tech-debt`). You can optionally add a suffix
   like `-tls` if you want to distinguish them.
6. Repeat for other workflows you wish to use globally.

## Step 6: Configure the MCP Server

Antigravity requires the MCP server to execute tools (like `rtk`).

1. Go to **Settings** (Gear icon) -> **MCP**.
2. Add a new MCP server named `tech-lead-stack`.
3. Use the following configuration (replacing `/path/to/tech-lead-stack` with
   your actual absolute path):

```json
{
  "mcpServers": {
    "tech-lead-stack": {
      "command": "npm",
      "args": [
        "--prefix",
        "/path/to/tech-lead-stack",
        "--silent",
        "run",
        "mcp:start"
      ]
    }
  }
}
```

## Step 7: Usage

You can now invoke these workflows in the Agent chat by typing `/` followed by
the workflow name.

---

name: workflow-clean-code-audit description: Clean Code Audit

---

// turbo

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Inspect the project root to
   identify the primary language and framework.

2. Call the tech-lead-stack.get_skills tool:
   - skillName: "clean-code"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to audit architecture and recommend SOLID improvements.

---
