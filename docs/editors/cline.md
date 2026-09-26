# Cline Setup

[← Back to the README](../../README.md)

Cline is MCP-only: there is no slash command picker, so skills arrive through
the `get_skill` tool once the server is registered.

```bash
git clone https://github.com/bronz3beard/tech-lead-stack.git ~/tech-lead-stack
~/tech-lead-stack/install.sh --link . --ide cline
```

The installer writes to Cline's settings inside VS Code's global storage:

```text
macOS: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
Linux: ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

It also checks `Code - Insiders`, `VSCodium` and `Cursor`, so a Cline install in
any of those is configured too. Reload the window afterwards, then ask the agent
to call `get_skill` with the skill you want. Cline also reads the root
`AGENTS.md` that the project link creates, so it picks up the conventions
automatically.

Remove it with `lead-clean --global --apply`.
