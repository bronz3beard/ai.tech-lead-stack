# Voice Relay Service

A Node/TypeScript service that acts as a local relay for a voice assistant. It
accepts spoken transcripts, parses them into a project and skill/workflow, and
drives a headless CLI agent (Antigravity `agy`, Claude Code `claude`, Codex
`codex`, `cursor-agent`, or local Ollama).

## Features

- **Agent-Agnostic & Keyless:** Rides your existing CLI tool subscription
  logins.
- **Strict Approval Gate:** Any command that attempts to write code will
  generate a _plan_ first. The plan is returned to the user, and execution
  requires an explicit `approve: true` signal.
- **Monorepo Discovery:** Recursively finds Git repositories within configured
  root paths, automatically detecting monorepo structures.
- **Workflow Registry:** Dynamically extracts skill and workflow commands from
  `SKILL.md` / `workflows/*.md` files across the codebase.

## Prerequisites

- Node.js >= 20
- Supported CLI tools installed (e.g. `agy`, `claude`, `codex`, `cursor-agent`,
  or `ollama`).

## Environment Setup

Create a `.env` file in the root of the repository (or in this directory) with
the following variables:

```env
# folder containing all codebases (recursively scanned)
PROJECT_ROOTS=/Users/bz3b/Desktop/repos

# MUST equal the app's EXPO_PUBLIC_RELAY_TOKEN
RELAY_TOKEN=<openssl rand -hex 32>

# MUST equal the port in the app's RELAY_URL
PORT=4601

# local|antigravity|claude|codex|cursor
PREFERRED_BACKEND=local

OLLAMA_URL=http://127.0.0.1:11434

# depending on your RAM you might want to change this model
# this model runs very well with 24Gb of RAM
OLLAMA_MODEL=qwen3:14b

# STACK_REPO optional: auto-resolve .agents/.ai relative to the relay's own path inside this repo
```

## Understanding AI Backends (`PREFERRED_BACKEND`)

If you are new to AI coding assistants, you might be wondering what the `PREFERRED_BACKEND` setting does and why there are different options. 

The Voice Relay acts as a "middleman" between your mobile voice assistant app and the actual Artificial Intelligence that reads and writes your code. Instead of building a new AI from scratch or talking directly to cloud servers via raw API keys, the relay connects to AI tools that you *already have installed on your local computer*. 

This is incredibly powerful because it means **you don't need new API keys**, and it automatically leverages your existing subscriptions and logins!

Here is a breakdown of the valid options you can set for `PREFERRED_BACKEND`:

- **`local` (Ollama)**
  - **What it is:** [Ollama](https://ollama.com/) is a free application that lets you run Large Language Models directly on your own computer's hardware, 100% offline and private.
  - **How it works here:** The relay will talk to your local Ollama instance (by default at `http://127.0.0.1:11434`). It uses the model specified in `OLLAMA_MODEL`. 
  - **Pros:** Completely private, free, no internet required.
  - **Cons:** It is currently "read-only" in this project (it can answer questions about your code but won't write or edit files). It also requires a powerful computer (lots of RAM) to run smart models.

- **`antigravity` (Google's IDE Agent)**
  - **What it is:** Antigravity (`agy`) is an advanced agentic coding assistant from Google.
  - **How it works here:** The relay acts as a headless controller for the `agy` command-line tool. It uses your existing Google OAuth login to securely connect to the cloud. When you ask for a code change, the relay runs `agy` in the background to generate a plan. If you approve the plan, it runs `agy` again to apply the edits.
  - **Pros:** Very powerful, capable of complex multi-file edits, and uses your existing authentication.

- **`claude` (Anthropic's Claude Code)**
  - **What it is:** [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) is a command-line agent built by Anthropic, powered by the Claude 3.7 model family.
  - **How it works here:** The relay uses the `claude` CLI installed on your machine. It relies on your existing Anthropic console login/billing. It orchestrates Claude in the background to plan and execute code changes based on your voice commands.
  - **Pros:** Exceptional reasoning and coding capabilities, leverages your existing Anthropic setup.

- **`codex` (OpenAI)**
  - **What it is:** A CLI agent tool powered by OpenAI's models (often tied to your ChatGPT subscription).
  - **How it works here:** The relay hooks into the `codex` CLI on your machine.
  - **Pros:** Fast and capable, utilizing your OpenAI account.

- **`cursor` (Cursor IDE Agent)**
  - **What it is:** [Cursor](https://www.cursor.com/) is a highly popular AI-first code editor. It includes a background agent (`cursor-agent`).
  - **How it works here:** The relay leverages Cursor's CLI agent to process your requests using your Cursor Pro subscription. 

### How does the Relay actually use them?
You might notice that the relay code doesn't make direct API calls to Anthropic or Google to generate code. Instead, the relay executes background terminal commands (like `agy -p "fix the bug" --mode plan`) on your computer. 

This approach ensures the relay remains completely **agent-agnostic**. It simply acts as a voice-driven remote control for the powerful command-line AI tools you already use every day!

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
- `POST /command` - Parses a voice transcript into `{ project, skill, details }`
  and either runs a read-only query or proposes a plan.
- `POST /apply` - Executes an approved proposal using the selected backend.

## Project Aliases

You can customize the spoken aliases for a project by creating a
`project-aliases.json` file in the root of the voice-relay folder.

```json
{
  "_ignore": ["a-repo-to-hide"],
  "my-repo-id": ["spoken alias one", "alias two"]
}
```
