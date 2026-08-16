# Voice Relay Service

A Node/TypeScript service that acts as a local relay for a voice assistant. It accepts spoken transcripts, parses them into a project and skill/workflow, and drives a headless CLI agent (Antigravity `agy`, Claude Code `claude`, Codex `codex`, `cursor-agent`, or local Ollama).

## Features

- **Agent-Agnostic & Keyless:** Rides your existing CLI tool subscription logins.
- **Strict Approval Gate:** Any command that attempts to write code will generate a *plan* first. The plan is returned to the user, and execution requires an explicit `approve: true` signal.
- **Monorepo Discovery:** Recursively finds Git repositories within configured root paths, automatically detecting monorepo structures.
- **Workflow Registry:** Dynamically extracts skill and workflow commands from `SKILL.md` / `workflows/*.md` files across the codebase.

## Prerequisites

- Node.js >= 20
- Supported CLI tools installed (e.g. `agy`, `claude`, `codex`, `cursor-agent`, or `ollama`).

## Environment Setup

Create a `.env` file in the root of the repository (or in this directory) with the following variables:

```env
# A comma-separated list of paths to recursively scan for Git projects.
PROJECT_ROOTS="/path/to/your/projects,/another/path"

# The shared secret token used to authenticate requests from the voice assistant client.
RELAY_TOKEN="your-secure-token"

# (Optional) Port to run the service on. Defaults to 4599.
PORT=4599
```

## Running the Service

```bash
# Install dependencies
pnpm install

# Start in development mode (auto-reloads on file changes)
npm run dev

# Start in production mode
npm start
```

## API Endpoints

- `GET /health` - Liveness check.
- `GET /projects` - Rescans and returns the list of discovered projects.
- `POST /command` - Parses a voice transcript into `{ project, skill, details }` and either runs a read-only query or proposes a plan.
- `POST /apply` - Executes an approved proposal using the selected backend.

## Project Aliases

You can customize the spoken aliases for a project by creating a `project-aliases.json` file in the root of the voice-relay folder.

```json
{
  "_ignore": ["a-repo-to-hide"],
  "my-repo-id": ["spoken alias one", "alias two"]
}
```
