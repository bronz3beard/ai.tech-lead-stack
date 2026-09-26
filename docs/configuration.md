# Configuration

[← Back to the README](../README.md)

## 🤖 AI Model Routing & Precedence

Model choices for AI responsibilities (`planner`, `implementer`, `auditor`,
`adjudicator`) are configured directly in the web UI at `/settings` (User
default routing) and on the Project settings surface (Per-project model
routing).

- **UI & DB Authoritative**: `MODEL_*` environment variables (`MODEL_PLANNER`,
  `MODEL_IMPLEMENTER`, `MODEL_AUDITOR`, `MODEL_ADJUDICATOR`) should be left
  **UNSET** so the UI and database remain the source of truth.
- **Precedence Chain**: `Project.settings.modelRouting` →
  `User.settings.modelRouting` → `System Default`. Environment variables remain
  available as an optional headless override only.

## Local Execution Tier

To use the fully offline `local` execution tier, set the following environment
variables:

- `LOCAL_MODEL_ENDPOINT`: The baseURL of the OpenAI-compatible local model
  server (e.g., `http://localhost:11434/v1` for Ollama).
- `LOCAL_MODEL_NAME`: The ID of the local model (e.g., `qwen2.5-coder:3b`,
  `llama-3.1:8b`).
- `LOCAL_MODEL_CLASS`: (Optional) The class of the local model (`small`, `mid`,
  `large`) used for filtering skills that require a minimum model size. As a
  rule of thumb:
  - `small`: < 10B parameters (e.g., `qwen2.5-coder:3b`, `qwen2.5-coder:7b`)
  - `mid`: 10B - 35B parameters (e.g., `qwen2.5-coder:32b`)
  - `large`: > 35B parameters (e.g., `qwen2.5-coder:72b`, `llama-3.1:70b`)
- `REFLEXION_MAX_WALLCLOCK_MS`: (Optional) The maximum wall-clock time in
  milliseconds allowed for the Reflexion loop when running locally.
