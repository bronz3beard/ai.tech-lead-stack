# Gemini CLI & Gemini Desktop Setup

[← Back to the README](../../README.md)

Both read the same config file, so one install covers them.

```bash
~/tech-lead-stack/install.sh --link . --ide gemini
```

This merges an `mcpServers` entry into `~/.gemini/settings.json` and leaves your
existing authentication block untouched. Like Cline, this is MCP-only: invoke
skills by asking for `get_skill` rather than through a picker.

> [!NOTE] Antigravity is a separate product from Gemini CLI. It stores its state
> as protobuf under `~/.gemini/antigravity/`, not JSON, so the installer cannot
> configure or clean it. Register its workflows through Agent Manager by hand,
> as described in the Antigravity section above.

Remove it with `lead-clean --global --apply`.
