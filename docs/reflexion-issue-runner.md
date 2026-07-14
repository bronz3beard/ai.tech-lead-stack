# Reflexion Issue Runner

The Reflexion Issue Runner enables cloud-based scheduling of the AI engineering loop. It allows engineers to kick off and guide the iterative process of planning, critiquing, and refining purely through GitHub Issues—even from a mobile device.

## The Workflow ("Label at Night, Answer Over Coffee")

1. **Start the Loop:** Create an issue describing your goal. Apply the `reflexion:run` label.
2. **Review Feedback:** The automated loop runs (generator & critic) and uploads an artifact with its findings, then leaves a comment on the issue. This comment includes the adjudicator verdict and interview questions.
3. **Resume the Loop:** Over coffee, reply to the issue starting with `/reflexion answers`, and include your filled-in YAML block based on the provided answers template.
4. **Final Approval:** Repeat until satisfied, then approve it to generate a final `ide-prompt.md`.

## Setup & Configuration

### Required Secrets

Ensure the repository has the following Action secrets configured:

- `GEMINI_API_KEY`: Used for generation (Google AI SDK).
- `ANTHROPIC_API_KEY`: Used for the Critic & Adjudicator (Anthropic AI SDK).

### Environment Variables

Configure these repository environment variables (defaults are applied securely if unset):

- `REFLEXION_MAX_COST_USD` (Default: `3`)
- `REFLEXION_MAX_REVISIONS` (Default: `3`)

## Security Model

- **No Push:** The runner is structurally prohibited from pushing code. The pipeline communicates via read-only state files and outputs solely as artifacts/comments.
- **Isolated Artifacts:** Loop state and execution outputs are safely zipped into a workflow artifact named `reflexion-state-<issue#>`. The state uses standard GitHub Actions artifact retention window restrictions.
- **Controlled I/O Boundaries:** LLMs only receive the parsed issue brief and YAML answers block as an isolated payload.
- **Untrusted Input Processing:** Comments are defensive-parsed using deterministic regex boundary extraction avoiding direct LLM routing.

## Troubleshooting

- **Missing Keys:** If a run immediately fails with a diagnostic comment stating missing API keys, check GitHub Secrets.
- **Cap Reached:** The system will log a comment terminating if max cost threshold or `10` comment loop cycles per issue turn is reached.
- **Stuck State:** Due to concurrency boundaries per issue, parallel comments on the same issue will wait.
