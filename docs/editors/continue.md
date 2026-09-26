# Continue Setup

[← Back to the README](../../README.md)

Continue support requires your Continue extension to have the MCP server
installed and the commands bound.

> [!NOTE] Continue's OSS release is frozen at v2.0.0 (following the Cursor
> acquisition). The installer targets this frozen schema. For a maintained,
> local-first alternative, we recommend using Cline.

## Step 1: Clone the Repository

Clone the `tech-lead-stack` repository to a permanent location on your machine.

```bash
git clone https://github.com/your-username/tech-lead-stack.git ~/tech-lead-stack
cd ~/tech-lead-stack
```

## Step 2: Run the Installer with Continue Flag

Run the installer with the `--ide continue` flag. The installer merges the setup
globally into `~/.continue/config.yaml` to make MCP and slash commands available
across all projects.

```bash
./install.sh --link . --ide continue
```

## Step 3: Verify the Global Config

The installer safely merges `tech-lead-stack` into the `mcpServers` list in your
global `~/.continue/config.yaml` and embeds all `.agents/workflows` as `prompts`
entries.

You can verify this by checking your config:

```bash
cat ~/.continue/config.yaml
```

## Step 4: Invoke Workflows

Open Continue in VS Code. You can now use the `/` command prefix in the chat to
see the newly imported workflows (e.g. `/plan-quick`). By putting the IDE agent
in "Agent" mode, it will have access to the Stack's MCP tools to execute
commands like `get_skills` natively!
