# Install, Link & Uninstall

[← Back to the README](../README.md)

One reference for every platform. The per-editor sections below go deeper; this
is the part that applies to all of them.

## The two halves of an install

`install.sh` writes to two places, and they have different lifetimes:

| Half             | Where                                                                                                       | Lifetime                                    | Removed by                    |
| :--------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------ | :---------------------------- |
| **Project link** | Inside the repo you point at: `.ai`, `.agents`, `AGENTS.md` symlinks plus two copied GitHub files           | Per project                                 | `lead-clean` (default)        |
| **Editor setup** | Your home directory: MCP registrations, generated slash commands, symlinked skills and prompts, shell alias | Per machine, shared by every linked project | `lead-clean --global --apply` |

This split is why cleanup is project-only by default. One editor setup serves
every project you link, so unlinking one project must never unregister the rest.

## Symlinking is optional

The project link uses symlinks so a `git pull` in the stack updates every linked
project at once. You can skip it entirely:

```bash
./install.sh --link . --ide claude-code --ide-only   # editor setup only, no project files
```

Use `--ide-only` when you only want the skills available in your editor, when
adding an editor to a project you linked previously, or when you cannot write
into the target repo. Nothing is created inside the project.

If a real `AGENTS.md` already exists in your project, the installer leaves it
alone rather than replacing it with a symlink.

## Command reference

**Installing**

| Command                                   | What it does                                      |
| :---------------------------------------- | :------------------------------------------------ |
| `./install.sh --link .`                   | Link the current project, auto-detect editors     |
| `./install.sh --link . --ide <mode>`      | Target one editor explicitly                      |
| `./install.sh --link . --ide-only`        | Editor setup only, write nothing into the project |
| `./install.sh --link . --mcp-name <name>` | Register the MCP server under a different name    |
| `./install.sh --link . --domains eng`     | Limit generated commands to certain skill domains |
| `./install.sh --link /path/to/project`    | Link a project other than the current directory   |
| `./install.sh --help`                     | Show all flags                                    |

`--ide` accepts `auto`, `cursor`, `continue`, `claude-code`, `cline`, `gemini`,
or `none`. `--domains` accepts any comma-separated mix of `eng`, `pm`, `hr`
(default: all three).

**Uninstalling**

| Command                       | What it does                                       |
| :---------------------------- | :------------------------------------------------- |
| `lead-clean`                  | Unlink the current project. Editor setup untouched |
| `lead-clean /path/to/project` | Unlink a different project                         |
| `lead-clean --dry-run`        | Preview the project unlink, delete nothing         |
| `lead-clean --global`         | Preview what a full editor removal would delete    |
| `lead-clean --global --apply` | Actually remove the editor setup from this machine |

**Shorthand**

Run `npm link` once inside the tech-lead-stack checkout and you get `lead-init`,
`lead-clean` and `lead-run` on your PATH, with no hardcoded paths in your shell
config. Every `./install.sh --link .` above can then be written `lead-init`.

## What each platform gets, and how to remove it

| Platform             | Install flag        | What it writes                                              | Slash commands?        |
| :------------------- | :------------------ | :---------------------------------------------------------- | :--------------------- |
| Claude Code          | `--ide claude-code` | `~/.claude/commands/tls/`, `~/.claude.json`                 | Yes, `/tls:<name>`     |
| Cursor               | `--ide cursor`      | `~/.cursor/skills/`, `~/.cursor/mcp.json`                   | Skills UI              |
| Continue             | `--ide continue`    | `~/.continue/config.yaml`, `~/.continue/prompts/`           | Prompt menu            |
| Cline                | `--ide cline`       | Cline's `cline_mcp_settings.json` in VS Code global storage | No, MCP only           |
| Gemini CLI / Desktop | `--ide gemini`      | `~/.gemini/settings.json`                                   | No, MCP only           |
| Claude Desktop       | auto-detected       | `claude_desktop_config.json`                                | No, MCP only           |
| Antigravity          | manual              | Workflows pasted into Agent Manager                         | Yes, via Agent Manager |

Cline and Gemini are MCP-only. Skills reach them through `get_skill`, not a
picker, which is why they have no generated command files to remove.

Antigravity stores its state as protobuf rather than JSON, so it cannot be
configured or cleaned automatically. Remove its workflows through Agent Manager.

## Removing the editor setup, on every platform

One command covers all of them:

```bash
lead-clean --global           # preview
lead-clean --global --apply   # remove
```

It walks every platform in the table above and removes only what points at your
checkout. Specifically:

- **MCP registrations** are matched by the path they reference, not by name, so
  a server you renamed with `--mcp-name` is still found. Other servers in the
  same config file are left untouched, as are your account and session state.
- **Generated command directories** are deleted outright, since the installer
  owns them completely.
- **Symlinked skills and prompts** are removed only when the link actually
  points into your checkout. Anything else in those directories stays.
- **The `rtk` shell alias** is stripped from `~/.zshrc` and `~/.bashrc`.

Every JSON file it edits is backed up to `<file>.bak` first, and the preview is
the default so you always see the list before anything is deleted.

Afterwards, restart your editor so it drops the removed MCP servers, and open a
new terminal so the removed alias disappears.

## Safety

`lead-clean` refuses to run against your home directory, the filesystem root, or
the tech-lead-stack repository itself. A copied file you have since edited, such
as a customised pull request template, is kept and reported rather than deleted.
Only symlinks that actually point into your checkout are removed, so a real
`.ai` directory of your own is never touched.
