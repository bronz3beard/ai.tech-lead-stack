# Hooks (Ownership Gates)

Hooks are declarative guards that enforce ownership and phase-transition safety at two critical points:
1. **MCP Call-time**: When an AI agent attempts to call a tool (skill), the middleware evaluates the target skill against these guards. Unsafe actions are blocked *before* execution.
2. **Commit/CI-time**: Enforced via `.husky/pre-commit` and CI jobs to ensure human-in-the-loop workflows aren't bypassed.

## Schema

Each JSON file in this directory represents a guard with the following structure:

```json
{
  "id": "guard-name",
  "description": "Human-readable description of what this guard does",
  "appliesToPhase": ["deploy", "build"],
  "condition": {
    "requireKi": "review-report",
    "requireKiStatus": "passed",
    "actorTypeNot": "USER",
    "consumesApprovedKi": true,
    "diffContains": ["**/auth/**", "**/payments/**", "infra/**"]
  },
  "action": "block" | "warn" | "require-human-approve",
  "message": "The message returned when the guard is triggered."
}
```

## Ownership Axis
Guards map strongly to the ownership axis:
- They prevent AI actors (`actorType != USER`) from self-approving high-risk actions like deployments or scaling.
- They enforce strict phase transitions (e.g. `build` cannot proceed if the upstream specification KI is not `human-approved`).
- They enforce protective boundaries around critical paths (auth, payments).
