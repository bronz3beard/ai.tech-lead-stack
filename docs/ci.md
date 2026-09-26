# 🧪 CI/CD

[← Back to the README](../README.md)

This repository uses **GitHub Actions** to validate:

1. **Skill Integrity**: Ensures all `.md` files in `.ai/skills/` have valid YAML
   frontmatter.
2. **Markdown Linting**: Prevents malformed instructions that could confuse
   agents.
3. **Script Permissions**: Ensures all tools in `scripts/` remain executable.

## Pro-Tip: The "Profile Locked" Error

If you get an error that the browser profile is "already in use," close your
active Chrome window or create a dedicated Profile for the Agent and update your
`.env` accordingly.

```bash

tech-lead-stack/
├── .ai/
│   ├── agents.md
│   └── skills/
│       ├── agent-optimizer.md
│       ├── code-review-checklist.md
│       ├── mission-architect.md
│       ├── planning-expert.md
│       ├── regression-bug-fix.md
│       ├── verification-auditor.md (Internal)
│       └── visual-verifier.md
├── .github/
│   └── workflows/
│       └── agent-ci.yml
├── scripts/
│   ├── autoeval-check.js
│   ├── cleanup.sh
│   ├── gh-pr-create.sh
│   └── upload-evidence.py
├── templates/
│   └── PULL_REQUEST_TEMPLATE.md
├── .env
├── .env.example
├── .gitignore
├── ONBOARDING.md
├── install.sh
├── package.json
├── README.md
└── requirements.txt

```
