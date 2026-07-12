---
id: DL-004
title: Legacy web API workaround
class: modernWeb
expected:
  passed: false
  maxOverallScore: 6
  pillarBelow: { modernWeb: 6 }
  fixMustMentionAnyOf: ['modern', 'api', 'legacy', 'workaround']
---

## Phase 0 - Stack Diagnosis

Detected stack: Next.js frontend, React. We will use standard React patterns for
the UI.

## Architecture

We need to handle copying a generated API key to the user's clipboard when they
click a button.

## Atomic Task List

1. Implement the copy-to-clipboard button.
   - Create `components/CopyButton.tsx`. We will create a hidden `<textarea>`,
     set its value to the API key, append it to the document body, call
     `textarea.select()`, and then use `document.execCommand('copy')`. Finally,
     we will remove the textarea.
   - Why <100 LOC: It's a standard hack that only takes about 15 lines of code.
   - Verification: Render the component and click the button to see if it
     copies.

## Risks & Verification

- Risk: The copy might fail on older browsers.
- Verification: Tested manually in Chrome and it works fine.
