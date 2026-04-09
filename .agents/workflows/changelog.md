---
name: changelog
description: Generate Changelog
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Inspect the project root to identify versioning files and branch prefix culture.

2. Call the get_changelog_generator tool (which may be prefixed by the server name depending on your client):
   - skillName: "changelog-generator"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to transform git history into semantic release notes.
