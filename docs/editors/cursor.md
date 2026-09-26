# Cursor Setup

[← Back to the README](../../README.md)

## Step 1: Clone the Repository

Open your terminal and clone the `tech-lead-stack` repository to a permanent
location on your machine.

```bash
git clone https://github.com/your-username/tech-lead-stack.git ~/tech-lead-stack
cd ~/tech-lead-stack
```

## Step 2: Run the Installer with Cursor Flag

Run the `install.sh` script to set up dependencies and link the stack to your
current working directory.

```bash
./install.sh --link . --ide cursor
```

_Note: This will also output a JSON snippet for MCP configuration. Keep this
handy for Step 4._

## Step 3: Verify Symlinked Skills

The `install.sh` script will automatically symlink the skills into your global
`~/.cursor/skills/` directory. You can verify this by running:

```bash
ls -la ~/.cursor/skills/
```

You should see symlinks to the `.ai/skills/` directory of the `tech-lead-stack`
repo.

## Step 4: Configure the MCP Server in Cursor

Cursor requires the MCP server to execute tools (like `rtk`).

1. Open **Cursor Settings** (Gear icon) -> **Cursor Settings**.
2. Select **MCP** from the sidebar.
3. Click **+ Add New MCP Server**.
4. Name the server `tech-lead-stack`.
5. Set the **Type** to `command`.
6. Use the following configuration (replacing `/path/to/tech-lead-stack` with
   your actual absolute path):

```json
{
  "command": "npm",
  "args": [
    "--prefix",
    "/path/to/tech-lead-stack",
    "--silent",
    "run",
    "mcp:start"
  ]
}
```

## Step 5: Usage

You can now invoke these skills in the Cursor chat by typing `@` followed by the
skill name (e.g., `@planning-expert`). Cursor will suggest the skill from the
list of available global skills.
