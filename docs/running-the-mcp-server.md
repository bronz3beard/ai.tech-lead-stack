# Running the MCP server

[← Back to the README](../README.md)

## Three Ways to Run the Tech-Lead-Stack MCP

The MCP server is built as a **standalone artifact** (`dist/mcp-server.mjs`),
which is why it can be reached in more than one way. There are three paths. Two
of them — **Direct** and **`install.sh`** — reach the _same_ MCP server
(install.sh just automates the setup); the **SLM Gate** path puts a gateway _in
front_ of it.

**Prerequisite for every path:** build the artifact once.

```bash
pnpm run mcp:build   # bundles src/mcp-server + src/lib/ai into dist/mcp-server.mjs
```

(`install.sh` runs this for you — see Path C.)

---

**Path A — Direct MCP** Point your IDE's MCP config straight at the stack's
`mcp:start`:

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

Best when: you use one IDE you configure by hand, working against the stack's
own repo. The server automatically falls back to the stack's own skills, so
nothing else is required.

---

**Path B — Through the SLM Gate (`mcp-gate`)** Instead of pointing your IDE at
the stack directly, run the SLM Gate's `mcp-gate` and set its `DOWNSTREAM_MCP`
env var to the stack's MCP artifact. The gate becomes the front door and
forwards tool calls _downstream_ to the tech-lead-stack MCP.

Best when: you want the gate's layer in front of the stack —
small-language-model / model routing, request filtering, or aggregating several
MCP servers behind a single endpoint — rather than talking to the stack in
isolation. The `mcp-gate` configuration (flags beyond `DOWNSTREAM_MCP`) lives in
the `@zenithfoundry/slm-gate` repo's own docs. (The stack is consumable by other
tools the same way — e.g. voice-relay via `STACK_REPO` — because it is just a
standalone artifact.)

**slm-gate is the worked example, not a requirement.** Any proxy that spawns or
forwards to `dist/mcp-server.mjs` produces this same topology; only the
registered name differs.

> **One consequence worth knowing before you set this up.** Behind a proxy, your
> client never sees a server called `tech-lead-stack`. The gateway is what is
> registered, and this stack's tools are re-exported under _its_ name — so the
> agent calls `mcp__slm-gate__get_skills`, not
> `mcp__tech-lead-stack__get_skills`. Generated slash commands name that tool
> explicitly, so they have to agree with it. `install.sh` detects a registered
> proxy that reaches this checkout and names it automatically; you do not need a
> flag. Full detail, including the detection rule and how to override it:
> **[docs/mcp-proxy-setup.md](mcp-proxy-setup.md)**.

---

**Path C — `install.sh` (turnkey setup of Path A + the full dev experience)**
Run `install.sh` if you want any of the following. It builds the artifact for
you and then wires the direct MCP config, so it is the automated form of Path A
plus extras:

1. **Skills on other repos** — symlinks `AGENTS.md` and `.agents/` into the
   target repo. Crucial for non-MCP agents (Copilot, Jules, simple
   rules-readers) and per-project skill overrides; also drops in the PR template
   and GitHub Actions.
2. **Terminal CLI or CI** — installs the `rtk` CLI, wires your shell alias,
   checks `gh` auth.
3. **Multi-IDE setup** — zero-touch MCP merges and workflow symlinking across
   Cursor, Continue, and Claude Desktop.
4. **First-time build** — runs `mcp:build` automatically.

---

**How they relate**

- Path A and Path C both give you the **direct** MCP server; Path C is just the
  turnkey installer (build + config + CLI + CI + cross-repo context) for it.
- Path B is the only one that changes the **topology**: the SLM Gate sits in
  front and the stack's MCP runs downstream of it.

> **Bottom line:** Talking to the stack in one IDE against this repo → **Path
> A**. Want the terminal tools, CI templates, multi-IDE support, or context
> files in other repos → **Path C** (`install.sh`). Want a gateway in front for
> routing/filtering/aggregation → **Path B** (SLM Gate). All three run the same
> built artifact underneath.

## 🔌 Consuming the MCP server

The MCP server logic is built as a standalone artifact that can be consumed by
other tools (e.g., SLM Gate's `mcp-gate` via the `DOWNSTREAM_MCP` env var, or
the voice-relay via `STACK_REPO`). To build it, run:

```bash
pnpm run mcp:build
```

This will bundle the core logic (`src/mcp-server` and `src/lib/ai`) into
`dist/mcp-server.mjs`.
