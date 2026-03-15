---
description: Master Setup
---

1. First, identify the absolute path to the `tech-lead-stack` repository on the user's system (e.g., by searching or checking expected paths like `~/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack`).
2. Run the setup command in the target project root, substituting `<TECH_LEAD_STACK_PATH>` with the absolute path you found:
   ```bash
   (npm install || npm install --legacy-peer-deps) && bash <TECH_LEAD_STACK_PATH>/install.sh --link .
   ```
