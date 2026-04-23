---
name: design-system-docs
description:
  Audit design system documentation in the current project. Detects whether
  documentation lives in Markdown files or Storybook. If Storybook is present,
  audits its quality and suggests improvements. If only Markdown (or no docs at
  all), produces a step-by-step plan to implement Storybook and improve existing
  documentation. Before using this skill we recommend running the design-expert
  skill to ensure there is a DESIGN.md file.
allowed-tools: Glob Read Grep Bash
effort: medium
cost: ~3200 tokens
---

# design-system-docs

**Role:** UX/UI expert and UI developer with deep experience in design systems,
component documentation, and Storybook.  
**Goal:** Find all design system documentation in this project, evaluate its
quality, and deliver a prioritized, actionable improvement plan — either for an
existing Storybook or for adopting Storybook when it is not yet present.

---

## Step 1 — Load project context

Check whether `AGENTS.md` and `DESIGN.md` exist at the project root.

- Read both if they exist — they provide the tech stack, styling approach,
  component library, and design tokens already documented.
- If neither exists, continue. Note this in the final report (both files improve
  the accuracy of this audit).

---

## Step 2 — Detect documentation type

Run both checks in parallel. The result determines which branch to follow.

### 2a — Storybook detection

Check for any of the following signals:

- `.storybook/` directory at the project root or in a monorepo package
- `@storybook/` prefix in `package.json` (or equivalent dependency file)
  dependencies or devDependencies
- `*.stories.*` files anywhere in the project (Glob:
  `**/*.stories.{js,ts,jsx,tsx,mdx,vue,svelte}`)
- `*.story.*` files (Glob: `**/*.story.{js,ts,jsx,tsx,mdx}`)

**Storybook is present** if any of the above is found.

### 2b — Markdown documentation detection

Search for design-related Markdown files:

- `DESIGN.md`, `STYLE.md`, `UI.md` at project root
- Any `.md` or `.mdx` files under `docs/`, `documentation/`, `design/`, `wiki/`
  directories
- Component-level `README.md` files co-located with component directories

---

## Step 3 — Branch on findings

### → If Storybook is present: go to **Section A** (Storybook Audit)

### → If Storybook is absent: go to **Section B** (Implementation Plan)

If both Storybook and Markdown docs are found, run Section A and note the
Markdown docs as supplementary context in the report.

---

---

# Section A — Storybook Audit

---

## A1 — Configuration audit

Read `.storybook/main.*` and `.storybook/preview.*` (or
`.storybook/preview.js`/`.ts`). Extract:

### Framework adapter

Identify the `framework` field in `main.*`. Verify it matches the project stack
from `AGENTS.md`:

| Project                   | Expected adapter                                             |
| ------------------------- | ------------------------------------------------------------ |
| Next.js                   | `@storybook/nextjs` or `@storybook/experimental-nextjs-vite` |
| Vite + React              | `@storybook/react-vite`                                      |
| Vite + Vue 3              | `@storybook/vue3-vite`                                       |
| SvelteKit                 | `@storybook/sveltekit`                                       |
| Angular                   | `@storybook/angular`                                         |
| Nuxt                      | `@storybook-vue3` + Nuxt module, or `@nuxtjs/storybook`      |
| Plain Vite (no framework) | `@storybook/html-vite` or `@storybook/web-components-vite`   |

Flag a mismatch or a deprecated/community adapter where an official one now
exists.

### Storybook version

Read the `@storybook/core` or `storybook` version from the dependency file.

- v8.x → current; check for specific deprecated APIs
- v7.x → supported but not latest; note upgrade path
- v6.x or below → end-of-life; flag as high priority upgrade

### Addons

List all addons configured in `main.*`. Compare against this reference set and
flag anything missing or worth adding:

| Addon                                                     | Purpose                                                  | Priority if missing             |
| --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------- |
| `@storybook/addon-essentials`                             | Docs, Controls, Actions, Viewport, Backgrounds, Toolbars | Critical                        |
| `@storybook/addon-a11y`                                   | Automated accessibility checks per story                 | High                            |
| `@storybook/addon-interactions`                           | Play-function interaction testing                        | High                            |
| `@storybook/test`                                         | Story-level assertions (replaces `@storybook/jest`)      | High                            |
| `@storybook/addon-designs`                                | Embed Figma designs alongside stories                    | Medium                          |
| `storybook-dark-mode` or native `@storybook/addon-themes` | Toggle dark/light theme                                  | Medium if project has dark mode |
| `@chromatic-com/storybook`                                | Visual regression testing via Chromatic                  | Low (external service)          |

### Preview configuration

Read `.storybook/preview.*` and check:

- **Global decorators** — is the project's theme provider / CSS reset / font
  applied to all stories? If not, every story will look wrong.
- **Backgrounds** — are project-relevant background colors configured (e.g., the
  app's page background, a dark surface)?
- **Viewport presets** — are the project's breakpoints registered as named
  viewports?
- **Global types / toolbar** — is a theme or locale switcher configured if the
  project needs it?

---

## A2 — Stories coverage audit

### Locate components

Use Glob to find all component files in the main UI component directory (detect
from `AGENTS.md` or scan for common locations: `src/components/`,
`src/lib/components/`, `components/`, `lib/ui/`, etc.).

Collect the component names (filename without extension, without `.stories.*`).

### Locate stories

Glob for all `*.stories.*` and `*.story.*` files. Extract component names they
correspond to.

### Coverage gap

List components that have **no** corresponding story file. Group by severity:

- **Critical (no story at all):** Core primitives — Button, Input, Select,
  Checkbox, Modal/Dialog, Tooltip, Badge, Card — any component that appears in
  many places.
- **Important:** Layout components, navigation, form wrappers, data display
  (Table, List).
- **Nice to have:** Page-level compositions, one-off components.

---

## A3 — Story quality audit

Read **every** existing story file. Evaluate each against the following
checklist:

### Structure

- [ ] Default export has `title`, `component`, and (for v7+)
      `tags: ['autodocs']` so the component page is auto-generated
- [ ] Stories are named exports (CSF3 format preferred over older CSF2
      `Template.bind({})` pattern)
- [ ] At least one story per meaningful visual state (default, loading,
      disabled, error, empty, different sizes/variants)

### Args and controls

- [ ] `args` are defined on stories so Controls panel is usable
- [ ] `argTypes` document non-obvious props (enum options, callback signatures,
      deprecated props)
- [ ] No hardcoded prop values that should be args — controls should actually
      control the story

### Interactions

- [ ] Interactive components (forms, dropdowns, modals) have `play` functions
      demonstrating real usage
- [ ] `play` functions use `@storybook/test` (`userEvent`, `expect`) — not older
      `@storybook/testing-library` if on v8+

### Documentation

- [ ] Component description is present (JSDoc on the component, or
      `parameters.docs.description.component`)
- [ ] Complex or non-obvious props have inline descriptions
- [ ] Usage notes or "do / don't" guidance exists for opinionated components

### Design tokens

- [ ] At least one story or MDX page renders the color palette
- [ ] At least one story or MDX page renders the typography scale
- [ ] Spacing, border radius, and shadow scales are documented if custom tokens
      exist

---

## A4 — MDX documentation pages

Check for MDX files inside `.storybook/` or alongside stories. Flag if missing:

| Page                                  | Why it matters                                |
| ------------------------------------- | --------------------------------------------- |
| Introduction / Getting Started        | Orients new contributors and designers        |
| Design Tokens (colors, type, spacing) | Makes tokens browsable without reading source |
| Component Guidelines / Do & Don't     | Prevents misuse of complex components         |
| Changelog / Version history           | Tracks breaking changes to the component API  |

---

## A5 — Report

Output findings in this format:

```
## Storybook Audit Report

**Storybook version:** X.X
**Framework adapter:** @storybook/xxx — ✅ correct | ⚠️ mismatch | ❌ missing
**Stories found:** X files covering Y of Z components (X% coverage)

---

### ❌ Critical issues (fix first)
- <issue — what it breaks — how to fix>

### ⚠️ Improvements (high value)
- <issue — impact — recommendation>

### 💡 Suggestions (nice to have)
- <suggestion — rationale>

### ✅ Already done well
- <what is working and should be kept>

---

### Coverage gaps
| Component | Priority | Recommended stories |
|-----------|----------|-------------------|
| Button | Critical | Default, Disabled, Loading, all variants × sizes |
| ...       | ...      | ...                |

---

### Recommended next steps (ordered by impact)
1. ...
2. ...
```

---

---

# Section B — Storybook Implementation Plan

_(Run this section only when Storybook is not present)_

---

## B1 — Assess existing documentation

Read all Markdown files found in Step 2b. For each file evaluate:

- **What is documented** — which components, tokens, or guidelines are covered
- **What is missing** — components or tokens with no documentation
- **Quality** — is the content descriptive enough for a developer to use the
  component correctly, or is it just a list of props?

Also scan component files directly: read 3–5 representative components to
understand how they are structured, what props they accept, and what states they
support.

---

## B2 — Detect the package manager

Check for lock files at the project root:

- `pnpm-lock.yaml` → `pnpm`
- `bun.lockb` or `bun.lock` → `bun`
- `yarn.lock` → `yarn`
- `package-lock.json` → `npm`

Use the detected package manager in all install commands in the plan below.

---

## B3 — Produce the implementation plan

Output a complete, ordered plan. Every step must be a concrete action — no vague
advice.

```
## Design System Documentation Plan

### Context
- **Existing docs:** <list MD files found and summarize what they cover>
- **Documentation gaps:** <what components or tokens have no docs>
- **Package manager:** <detected>
- **Framework:** <detected from AGENTS.md or file scan>

---

### Phase 1 — Install and configure Storybook

**Step 1 — Initialize Storybook**

Run the Storybook CLI initializer (it auto-detects the framework):

\`\`\`bash
<package-manager> dlx storybook@latest init
\`\`\`

> If the framework is not auto-detected correctly, specify it:
> `storybook init --type <react|vue3|angular|svelte|html>`

The initializer will:
- Install `storybook` and the correct framework adapter
- Add `@storybook/addon-essentials`
- Create `.storybook/main.*` and `.storybook/preview.*`
- Create example story files (delete these after confirming setup works)

**Step 2 — Verify the adapter**

Open `.storybook/main.*` and confirm the `framework` field matches the project:
<insert correct adapter for this project's framework here>

**Step 3 — Connect the project's theme and styles**

Edit `.storybook/preview.*` to:
- Import the global CSS / stylesheet entry point so stories render with the project's fonts and resets
- Wrap stories in any required theme provider (e.g., a context provider, a CSS class on the root element)

Example pattern (adapt to the project's actual setup):
\`\`\`ts
// .storybook/preview.ts
import '../src/styles/globals.css'; // or wherever global styles live

export const decorators = [
  (Story) => /* wrap in theme provider if needed */ Story(),
];
\`\`\`

**Step 4 — Configure backgrounds and viewports**

In `.storybook/preview.*`, add the project's real background colors and breakpoints:

\`\`\`ts
export const parameters = {
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light', value: '<page background color from DESIGN.md>' },
      { name: 'dark', value: '<dark background color if applicable>' },
    ],
  },
  viewport: {
    viewports: {
      mobile: { name: 'Mobile', styles: { width: '<sm breakpoint>', height: '812px' } },
      tablet: { name: 'Tablet', styles: { width: '<md breakpoint>', height: '1024px' } },
      desktop: { name: 'Desktop', styles: { width: '<lg breakpoint>', height: '900px' } },
    },
  },
};
\`\`\`

**Step 5 — Install recommended addons**

\`\`\`bash
<package-manager> add -D @storybook/addon-a11y @storybook/addon-interactions @storybook/test
\`\`\`

Register them in `.storybook/main.*` addons array.

---

### Phase 2 — Write stories (priority order)

Write stories for components in this order — highest reuse and visibility first:

**Priority 1 — Core primitives** (cover all variants and states)
<list the core primitive components found in the project: Button, Input, etc.>

For each, create a story file co-located with the component (`Button.stories.ts` next to `Button.*`):
- Default story with args
- One story per major variant (filled, outline, ghost, etc.)
- Disabled state
- Loading / pending state if applicable
- Error state if applicable

**Priority 2 — Composite components** (focus on states and composition)
<list composite components found: Card, Modal, Form, Table, etc.>

- Default / populated story
- Empty state
- Loading state
- Error or validation state

**Priority 3 — Layout and navigation**
<list layout components found: Sidebar, Header, Tabs, etc.>

- Typical use story
- Collapsed / mobile story if responsive

---

### Phase 3 — Document design tokens

Create an MDX file at `.storybook/Introduction.mdx` or `src/stories/DesignTokens.mdx`.

Include:

1. **Colors** — render each color token as a swatch with its name and value
2. **Typography** — render each type scale step as live text
3. **Spacing** — render a visual ruler of the spacing scale
4. **Border radius** — render boxes showing each radius token
5. **Shadows** — render boxes showing each shadow token

Reference the tokens from their actual source (CSS variables, theme object, Tailwind config) — do not hardcode values.

---

### Phase 4 — Improve existing Markdown docs

Based on the review in B1, apply these improvements to existing MD files:

<list specific gaps found — e.g.:
- "DESIGN.md documents colors but lacks typography — add a type scale table"
- "No component-level docs exist — add README.md to Button and Card directories describing props and usage"
- "docs/ui.md has outdated component names — update to match current file structure"
>

---

### Phase 5 — Continuous improvement (ongoing)

- Adopt the **story-first** habit: when a new component is added, its story file is created at the same time
- Add Storybook to CI to catch visual regressions (Chromatic free tier or `test-storybook` for interaction tests)
- When a component's API changes, update its story `args` and `argTypes` in the same PR
```

---

## B4 — Summary to user

After outputting the plan, summarize:

- What documentation currently exists and its quality score (good / partial /
  missing) per area
- Which phase to tackle first based on the current state
- If `DESIGN.md` was not found: recommend running `/design-expert` first, as it
  produces the token reference the Storybook plan depends on
- If `AGENTS.md` was not found: recommend running `/init-project` first so the
  Storybook adapter and install commands can be made fully accurate
