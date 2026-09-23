# Running the stack behind an upstream MCP proxy

This document covers what changes when a gateway sits in front of the
tech-lead-stack MCP server, why slash commands are affected, and how the
installer handles it.

It uses **slm-gate** as the worked example throughout because it is the
reference implementation. **Nothing here is specific to slm-gate.** Every rule,
every detection mechanism, and every command below applies unchanged to any
proxy that forwards to this stack.

---

## 1. The two topologies

The MCP server is a standalone artifact (`dist/mcp-server.mjs`). A client can
reach it in one of two shapes.

### Direct

The client launches this stack itself.

```
Claude Code  ──spawns──▶  tech-lead-stack MCP
```

The client registers it as `tech-lead-stack`, and the agent sees its tools as:

```
mcp__tech-lead-stack__get_skills
mcp__tech-lead-stack__list_skills
```

This is the default and needs nothing from this document.

### Behind a proxy

A gateway process is registered with the client instead. The gateway spawns or
forwards to this stack downstream.

```
Claude Code  ──spawns──▶  slm-gate  ──forwards──▶  tech-lead-stack MCP
```

**The client never sees a server called `tech-lead-stack` at all.** It only
knows about the gateway. This stack's tools are re-exported under the
_gateway's_ name:

```
mcp__slm-gate__get_skills
mcp__slm-gate__list_skills
```

Substitute any other proxy's registered name and the shape is identical.

**The gateway's environment reaches this stack.** A gateway that spawns the
stack usually passes its own environment down, and dotenv never overrides a
variable that is already set. That is why the stack reads Langfuse credentials
from `TLS_LANGFUSE_*` rather than `LANGFUSE_*`: the gateway's keys cannot
redirect the stack's traces into the gateway's project. See §7 if you see paired
traces.

---

## 2. Why this matters for slash commands

Registration and tool naming are two different things, and only one of them is
obvious.

A generated slash command (`~/.claude/commands/tls/*.md`) does not call this
stack. It contains an instruction to the agent to call a **tool**, named in
full:

```markdown
You MUST call the MCP `mcp__slm-gate__get_skills` tool.
```

That name has to match what the client actually exposes. If the commands say
`mcp__tech-lead-stack__get_skills` while the client only knows `slm-gate`, the
agent is told to call a tool that exists in no session.

**The failure is silent.** Nothing errors at install time, nothing errors at
startup. The command simply appears not to work, or the agent improvises
something else. With 53 generated commands, that is 53 quiet failures.

---

## 3. How the installer resolves it

`install.sh` detects the proxy automatically. There is no flag to remember and
no per-project configuration.

### The detection rule

> A registered MCP server whose **definition mentions this checkout's path** is
> serving this stack.

`resolve_command_server_name()` in `install.sh` reads the client's registered
servers, JSON-stringifies each server object whole, and looks for `$SOURCE_DIR`
anywhere inside it.

This is why it is proxy-agnostic — it never looks for the string `slm-gate`.
slm-gate names the downstream target in a `DOWNSTREAM_MCP` env var; another
proxy might name it in `args`, or in a `--downstream` flag, or in a config path.
All of them are matched by the same rule, because all of them must name this
checkout somewhere to reach it.

The same detection already existed in `setup_claude_code_mcp()`, where it
prevents registering a duplicate server. It computed the gateway's name and
discarded it; the fix reuses that fact for command generation.

### What it decides

| Registered servers matching this checkout | Result                                              |
| ----------------------------------------- | --------------------------------------------------- |
| None                                       | Default `tech-lead-stack`. A plain direct install.   |
| Exactly one, at user scope                 | That server's name is baked into the commands.       |
| More than one, at user scope               | Default kept, warning printed — it will not guess.   |
| Only at project scope                      | Default kept, warning printed — see below.           |
| `--mcp-name` or exported `MCP_SERVER_NAME` | Detection skipped entirely. An explicit choice wins. |

### Why user scope only

Slash commands live in `~/.claude/commands/tls/` and apply to **every** project
on the machine. A gateway registered for one project cannot be baked in globally
without breaking every other project, so that case warns and keeps the default
rather than producing a global setting from local information.

If you hit that warning and want the gateway used everywhere, register it at
user scope:

```bash
claude mcp add-json slm-gate '<server json>' --scope user
./install.sh --link --ide-only --ide claude-code
```

### Direct installs are unaffected

The default stays `tech-lead-stack`, and detection finds nothing on a machine
with no gateway. The stack remains fully usable standalone; the proxy is
optional and always has been.

One useful side effect: if you registered this stack directly but under a custom
name (say `tls`), detection finds that too and bakes `mcp__tls__`, because that
is genuinely where the tools appear.

---

## 4. Setting it up with slm-gate

Worked example. Adapt the command and the downstream-naming mechanism for a
different proxy.

### Step 1 — build the artifact

```bash
cd /path/to/tech-lead-stack
pnpm run mcp:build
```

### Step 2 — register the gateway with your client

This is **client** configuration (`~/.claude.json` for Claude Code). The gateway
is the registered server; this stack appears only inside `DOWNSTREAM_MCP`:

```json
{
  "mcpServers": {
    "slm-gate": {
      "command": "node",
      "args": ["/abs/path/to/small-language-model-gate/dist/mcp-gate/index.js"],
      "env": {
        "TLS_ADAPTER": "on",
        "DOWNSTREAM_MCP": "{\"command\":\"node\",\"args\":[\"/abs/path/to/tech-lead-stack/dist/mcp-server.mjs\"]}"
      }
    }
  }
}
```

Register it at **user scope** so it applies to every project.

Note that `/abs/path/to/tech-lead-stack` appears inside the value. That is what
the installer matches on.

### Step 3 — generate the slash commands

```bash
./install.sh --link --ide-only --ide claude-code
```

Expected output:

```
   - 'slm-gate' is already registered with Claude Code and reaches this checkout.
     Slash commands will call mcp__slm-gate__<tool>, which is where this
     stack's tools actually appear. Pass --mcp-name to override.
   ✅ Generated 53 slash command(s) calling mcp__slm-gate__<tool>.
   - Claude Code already reaches this checkout via: slm-gate.
     Leaving it alone. Pass --mcp-name to add a separate one deliberately.
```

Two things to read in that output: the commands name the gateway, and the
installer did **not** register a second server.

### Step 4 — restart every MCP client

Claude Code caches its tool list per session. Quit and reopen every window, or
use `/mcp` to reconnect.

### Step 5 — verify

```bash
# Every generated command names the gateway, and nothing else:
grep -rho "mcp__[a-z0-9-]*__" ~/.claude/commands/tls/ | sort | uniq -c
#   194 mcp__slm-gate__

# The client lists that server:
#   /mcp   →  slm-gate   connected
```

---

## 5. Overriding the detection

Two equivalent forms, both of which disable detection:

```bash
./install.sh --link --ide-only --mcp-name slm-gate
MCP_SERVER_NAME=slm-gate ./install.sh --link --ide-only
```

`install.sh` is a shell script and does **not** read `.env`. Documenting the
value in `.env.example` records your topology; exporting it or passing the flag
is what makes it take effect.

Reach for an override when:

- the warning about multiple matching servers appeared and you know which one
  the client lists;
- your proxy reaches this stack in a way that does not name the checkout path
  (a fixed alias in the proxy's own config file, for instance), so detection
  cannot see it;
- you are deliberately registering a second, separately-named server.

---

## 6. When you change proxies

Any change to how the client reaches this stack — adding a gateway, removing
one, renaming it, moving from project to user scope — invalidates the generated
commands, because the tool name they contain changed.

```bash
./install.sh --link --ide-only --ide claude-code   # regenerate
# then restart every MCP client
```

The generator stages into a temporary directory and swaps atomically, so a
failure part-way through leaves the previous command set intact.

---

## 7. Diagnosing a broken setup

**Symptom: a `/tls:<name>` command runs but the agent cannot find the tool.**

The baked name and the registered name disagree. Compare them:

```bash
# What the commands ask for:
grep -rho "mcp__[a-z0-9-]*__" ~/.claude/commands/tls/ | sort | uniq -c

# What the client actually has registered:
node -e "const c=require(require('os').homedir()+'/.claude.json'); console.log(Object.keys(c.mcpServers||{}))"
```

If they differ, regenerate (§6). If they match and it still fails, the client
has not been restarted since the change.

**Symptom: the installer registered a second server.**

The gateway's definition does not mention this checkout's path, so neither the
duplicate-registration guard nor the command-name detection can see it. Point
the gateway at this checkout by absolute path, or use `--mcp-name`.

**Symptom: every skill run shows two traces in the gateway's Langfuse project.**

For example, `skill:ask` from this stack next to `ask` from the gateway. The
stack is running a build from before the `TLS_LANGFUSE_*` rename and has picked
up the gateway's `LANGFUSE_*` keys. Rename the stack's variables (see
`CHANGELOG.md`), run `npm run mcp:build`, and restart the client. The stack's
traces then go to its own project with environment `tls` and tag `source:tls`.

**Symptom: `list_skills` works but `get_skills` fails on a name it listed.**

Unrelated to proxying — that is a skill-resolution problem. See
`docs/skill-readiness.md` and the `agent-surfaces.json` drift gate.

---

## 8. Related

- `README.md` → "Three Ways to Run the Tech-Lead-Stack MCP" — Path B is this
  topology.
- `.env.example` → the `MCP SERVER & UPSTREAM PROXY` section.
- `install.sh` → `resolve_command_server_name()` carries the rationale inline.
- `scripts/generate-ide-commands.mjs` → the `--server` flag this all feeds.
