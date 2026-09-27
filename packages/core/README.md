# tech-lead-stack

The MCP server for the
[Tech-Lead Stack](https://github.com/bronz3beard/ai.tech-lead-stack): agent
skills and workflows for tech leads, product managers and HR, served to any
MCP-capable editor or agent. The skills are bundled; nothing else needs to be
cloned.

Requires Node.js 22.5 or later.

## Connect it to your editor

### Claude Code

```bash
claude mcp add tech-lead-stack -- npx -y tech-lead-stack
```

### Cursor, Continue, Cline, Antigravity and other MCP clients

Add this to the client's MCP server configuration:

```json
{
  "mcpServers": {
    "tech-lead-stack": {
      "command": "npx",
      "args": ["-y", "tech-lead-stack"]
    }
  }
}
```

Then ask your agent to list the available skills.

### Behind a gateway such as slm-gate

If your editor already talks to a gateway, let the gateway start this server
instead of registering it a second time. For slm-gate, add these two values to
the `env` block of your existing `slm-gate` entry, then restart your editor:

```json
"TLS_ADAPTER": "on",
"DOWNSTREAM_MCP": "{\"command\":\"npx\",\"args\":[\"-y\",\"tech-lead-stack@1\"]}"
```

The tools then appear under the gateway's name, such as
`mcp__slm-gate__list_skills`. See
[Running the stack behind an upstream MCP proxy](https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/mcp-proxy-setup.md#without-a-clone-start-the-stack-with-npx).

## Settings and API keys

Put settings in one file, `~/.tech-lead-stack/.env`, and every editor uses them.
A value in an editor's MCP `env` block wins over the file, for that editor only.
The server never reads the `.env` of the project you have open; that file
belongs to your app.

Tools that call models themselves, such as the reflexion loops, need the
matching API keys (for example `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`). See
[Configuration](https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/configuration.md).

## Usage metrics

Add `DATABASE_URL` to `~/.tech-lead-stack/.env` and every skill and tool call is
recorded. To see the results, run the web app against the same database:
[Run it on your own machine](https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/web-app.md#run-it-on-your-own-machine).
Without `DATABASE_URL`, nothing is recorded and everything else works.

## Verify the package

Every release is built and published by GitHub Actions with npm provenance:

```bash
npm audit signatures
```

## Help, bugs and security

- Questions and bugs:
  [SUPPORT.md](https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/SUPPORT.md)
- Vulnerabilities (report privately):
  [SECURITY.md](https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/SECURITY.md)

## Licence

[MIT](https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/LICENSE)
