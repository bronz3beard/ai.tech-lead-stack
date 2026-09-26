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

Tools that call models themselves, such as the reflexion loops, need the
matching API keys (for example `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) in the
server's environment. See
[Configuration](https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/configuration.md).

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
