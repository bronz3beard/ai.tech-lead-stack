# Claude Code Setup

[← Back to the README](../../README.md)

Claude Code (the VS Code extension, desktop app, and CLI) is supported natively.
The installer generates one slash command per skill and registers the MCP server
at user scope, so the stack behaves the same way it does in Antigravity or
Cursor.

## What gets installed, and where

This is the only integration that writes to **two locations outside your
project**. Both are in your home directory, not in your app repository:

| Path                      | What it holds                                                                                                | Safe to delete?                                              |
| :------------------------ | :----------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| `~/.claude/commands/tls/` | One generated `.md` file per skill. These are build artifacts and are regenerated from scratch on every run. | Yes. Re-run the installer to restore.                        |
| `~/.claude.json`          | Your Claude Code config. The installer adds one key under `mcpServers` and touches nothing else.             | **No.** This file also holds your account and session state. |

> [!IMPORTANT] `~/.claude.json` is a live file that Claude Code rewrites while
> it runs. The installer prefers the `claude` CLI
> (`claude mcp add-json ... --scope user`) and only edits the file directly when
> that CLI is unavailable. In the fallback path it writes a backup to
> `~/.claude.json.bak` first and replaces the file atomically. Nothing inside
> your project is modified either way.

## Step 1: Clone the Repository

```bash
git clone https://github.com/bronz3beard/tech-lead-stack.git
cd tech-lead-stack
```

## Step 2: Run the Installer with the Claude Code Flag

```bash
./install.sh --link . --ide claude-code
```

**Already linked this project with a previous `install.sh` run?** You do not
need to re-link anything. The Claude Code surface is entirely global, so one run
from any directory enables it for every project you have linked, past and
future. Use `--ide-only` to skip project linking, dependency installs, and the
GitHub CLI auth check:

```bash
./install.sh --link . --ide claude-code --ide-only
```

## Step 3: Verify

```bash
# The MCP server is registered at user scope
jq '.mcpServers["tech-lead-stack"]' ~/.claude.json

# The slash commands were generated
ls ~/.claude/commands/tls/ | head

# The generated commands name the tool your client actually exposes
grep -rho "mcp__[a-z0-9-]*__" ~/.claude/commands/tls/ | sort | uniq -c
```

The last check should print exactly one name. On a direct install it is
`mcp__tech-lead-stack__`. If you run the stack behind a proxy it is the
**proxy's** name (`mcp__slm-gate__`, or whatever yours is registered as), and
the first check above finds nothing under `tech-lead-stack` — that is correct,
not a failure. See
[Running the stack behind an upstream MCP proxy](../mcp-proxy-setup.md).

## Step 4: Use It

Reload Claude Code, then type `/tls:` in the chat. The picker lists every
generated command, for example `/tls:ask`, `/tls:plan`, or
`/tls:vertical-slice`. Each command carries its workflow's full instructions, so
Phase 0 skill acquisition and every downstream gate behave exactly as they do in
other clients. Anything you type after the command name is passed through as
extra context.

```text
/tls:vertical-slice decompose the checkout refactor into slices
```

## Options

| Flag                | Default           | Why you would change it                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------------------ | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ide-only`        | off               | Configure the IDE surface and stop. No project files are written, no dependencies installed, no `gh auth` wait.                                                                                                                                                                                                                                                                                                                                                                  |
| `--mcp-name <name>` | `tech-lead-stack` | Register the MCP server under a different name, **and** force that name into the generated commands as `mcp__<name>__<tool>`. You rarely need this: when a proxy is already registered and reaches this checkout, the installer detects it and names it automatically. Pass this to override the detection, or to add a second deliberately-named server. `MCP_SERVER_NAME=<name>` in the environment does the same thing. See [docs/mcp-proxy-setup.md](../mcp-proxy-setup.md). |
| `--domains <list>`  | `eng,pm,hr`       | Restrict generated commands to certain skill domains. `--domains eng` gives you engineering skills only.                                                                                                                                                                                                                                                                                                                                                                         |

## Which skills become commands

A skill is offered to Claude Code when **either** of these is true:

1. A workflow launcher exists for it in `.agents/workflows/`,
   `.agents/pm-workflows/`, or `.agents/hr-workflows/`.
2. It is `surface: public` **and** its `modes` include `mcp`.

This is the same agent-agnostic rule every installer adapter uses, read from
`.ai/agent-surfaces.json`. It means `surface: internal` skills stay out of your
command picker unless a workflow deliberately exposes them, and skills that
never declared themselves MCP-callable are never offered through an MCP-backed
command. See [Skill Readiness](../skill-readiness.md) for how the gating fields
work.

## Uninstalling

```bash
rm -rf ~/.claude/commands/tls
claude mcp remove tech-lead-stack --scope user
```
