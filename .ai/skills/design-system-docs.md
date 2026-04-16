---
name: design-system-docs
description: High-integrity audit and generation of design system documentation. Ensures components are mapped to usage guidelines, accessibility standards, and Storybook/MDX definitions.
cost: ~1000 tokens
---

# Design System Docs (The Architect's Auditor)

> [!IMPORTANT]
> **Diagnosis before Advice**: This skill follows the **G-Stack Methodology**. You must first understand the project's documentation architecture (Storybook, MDX, or custom) before performing an audit or generating content. Adheres to **MinimumCD** via automated validation gates.

## Phase 0: Tech-Stack Discovery & Diagnosis
Before proposing changes or identifying missing docs, establish the environment context:

1.  **Architecture Scan**: Identify where components reside (e.g., `src/components`, `ui/`, `lib/`).
2.  **Documentation Discovery**: Locate existing documentation roots (`docs/`, `.storybook/`, `README.md` per component).
3.  **Format Identification**: Determine if the project uses Markdown, MDX, Storybook (CSF), or a custom internal portal.
4.  **Metadata Audit**: Check for existing patterns like Frontmatter in `.mdx` files or JSDoc in component files to maintain stylistic consistency.

## Phase 1: Documentation Audit & Implementation
Perform a deep-dive audit or implement missing documentation based on the following stages:

### Stage 1: The Coverage Audit
- **Mapping**: Create a 1:1 mapping of components to documentation files.
- **Identify Gaps**: List "Orphaned Components" (code exists, no docs) and "Dead Docs" (docs exist, code is gone).

### Stage 2: Content Structural Integrity
Verify every document contains the following mandatory sections:
- **Usage Guidelines**: Explicit "When to use" vs. "When not to use" scenarios.
- **Props/API Reference**: Automated extraction of component interfaces or manually maintained API tables.
- **Accessibility (A11y)**: Specific instructions on keyboard navigation, ARIA roles, and screen-reader behavior.
- **Visual Examples**: Direct links to stories or live code playgrounds.

### Stage 3: Logic & Pattern Detection
- **Sync Check**: Ensure documentation reflects the current logic (e.g., if a component has a `loading` state in the code, it must be documented).
- **Tone & Voice**: Verify content adheres to the project's specific documentation style guide.

## MinimumCD & Quality Verification
All documentation changes must pass the following gates:

| Gate | Verification Method | Pass Criteria |
| :--- | :--- | :--- |
| **Integrity** | `grep` / `ls` | 100% component-to-doc mapping reached. |
| **Syntax** | MDX/Markdown Lint | Zero syntax errors or broken internal links. |
| **A11y Check** | Static Analysis | Accessibility section contains required `role` and `aria` guidance. |
| **Sync Check** | Logic comparison | Props in documentation match the Component's Type definitions (TS/PropTypes). |

### Automated Verification Actions
- Run `markdownlint` on all changed files.
- Verify Storybook builds (if applicable) using `npm run build-storybook`.
- Ensure no hardcoded absolute paths exist in the documentation.