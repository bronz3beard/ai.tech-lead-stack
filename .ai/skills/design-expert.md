---
name: design-expert
description: Scan the current project for all design-related information (theme, brand colors, typography, spacing, design system, component patterns, dark mode, etc.) and generate a DESIGN.md file to guide future AI agents in UI/UX work. Use when starting UI work on an unfamiliar codebase or to document an existing design system.
allowed-tools: Glob Read Grep Write AskUserQuestion
effort: medium
cost: ~3500 tokens
---

# design-expert

**Role:** Senior UI/UX Engineer and design systems architect.  
**Goal:** Extract every design decision baked into this codebase — colors, typography, spacing, component patterns, design system usage, theming — and produce a `DESIGN.md` that gives any AI agent enough context to write UI code that looks and feels native to this project.

---

## Step 1 — Stack context and existing documentation

### AGENTS.md

Check whether `AGENTS.md` exists at the project root.

- **If it exists:** Read the `## Stack → Styling` section to identify the styling approach (Tailwind, CSS Modules, styled-components, etc.) and any component library (shadcn/ui, MUI, Chakra UI, Radix, etc.). This informs which files to prioritize in the scan.
- **If it does not exist:** Continue without it — detect the styling approach by scanning for config files in Step 2.

### DESIGN.md

Check whether `DESIGN.md` exists at the project root.

- **If it exists:** Read it in full and keep it in memory. The full scan in Steps 2–3 runs regardless — the existing file is used later in Step 4 to identify gaps, stale values, and missing sections. Do not skip or shortcut any scan step because a DESIGN.md is already present.
- **If it does not exist:** Continue — the file will be created from scratch in Step 4.

---

## Step 2 — File discovery

Use Glob and Grep to locate all design-relevant files. Search broadly; do not skip files just because they look unfamiliar.

### 2a — Config and token files

Search for these patterns:

```
tailwind.config.ts
tailwind.config.js
tailwind.config.mjs
theme.ts  /  theme.js  /  theme.mjs
tokens.ts  /  tokens.js  /  design-tokens.*
colors.ts  /  colors.js
typography.ts  /  typography.js
spacing.ts  /  spacing.js
styles/theme.*
src/theme.*
lib/theme.*
*.tokens.json
tokens.json
style-dictionary.config.*
```

### 2b — Global stylesheets

Search for global CSS entry points:

```
globals.css  /  global.css
index.css  /  main.css  /  app.css
styles/globals.*  /  styles/index.*  /  styles/variables.*
assets/styles/**
```

Read the files found — look for CSS custom properties (`--variable-name`), `@layer`, `@theme`, and `@font-face` declarations.

### 2c — Component library configuration

Grep dependency files (`package.json`, `Gemfile`, `pubspec.yaml`, `requirements.txt`, `pyproject.toml`, or equivalent) for UI component libraries. Cast a wide net — do not limit to any single framework:

**React ecosystem**
```
shadcn-ui / @shadcn/ui  •  @mui/material / @mui/joy  •  @chakra-ui/react
@radix-ui/*  •  @headlessui/react  •  @mantine/core  •  antd  •  react-aria-components
```

**Vue ecosystem**
```
vuetify  •  primevue  •  @nuxt/ui  •  quasar  •  naive-ui  •  element-plus  •  vant
```

**Svelte ecosystem**
```
@skeletonlabs/skeleton  •  shadcn-svelte  •  bits-ui
```

**Angular ecosystem**
```
@angular/material  •  primeng  •  ng-zorro-antd  •  @taiga-ui/core
```

**Framework-agnostic / web components**
```
daisyui  •  bootstrap  •  bulma  •  @shoelace-style/shoelace  •  flowbite
```

Also check for:
- `components.json` at the project root (shadcn/ui config)
- A dedicated components or UI directory: `src/components/ui/`, `src/lib/components/`, `app/components/`, `lib/ui/`
- `theme/` or `design-system/` directories

### 2d — Font and icon configuration

Look for fonts via any of these mechanisms (framework-agnostic):
- `@fontsource/*` packages in dependency files
- `<link rel="stylesheet" href="...fonts.googleapis.com...">` or `<link rel="preconnect" ...>` in any HTML template (`index.html`, `app.html`, `_document.*`, layout files)
- `@font-face` declarations in CSS/SCSS files
- Framework-specific helpers: `next/font`, `nuxt-fonts`, `astro:assets` font imports — check layout/entry files for the framework detected in AGENTS.md

Look for icon libraries in dependency files (any framework):
```
lucide  •  lucide-react  •  lucide-vue-next  •  lucide-svelte
@heroicons/*  •  @tabler/icons-*  •  phosphor-*
react-icons  •  vue3-icons  •  unplugin-icons
@iconify/*  •  @fortawesome/*  •  material-icons
```

### 2e — Storybook and documentation

Check for:
- `.storybook/` directory and its `main.*` / `preview.*` files
- `docs/design/`, `docs/ui/`, `docs/components/` directories
- Any `DESIGN*.md`, `STYLE*.md`, or `UI*.md` files already present

---

## Step 3 — Deep read and extraction

Read every file found in Step 2. Extract the following information precisely — use actual values from the code, never guess.

### 3a — Color system

From `tailwind.config.*`, CSS variables, or theme files, extract:

- **Brand / primary colors** — name and hex/hsl/rgb value
- **Neutral / gray scale** — all shades if defined
- **Semantic colors** — success, warning, error, info
- **Background and surface colors** — page background, card/panel surface, muted/subtle backgrounds
- **Text colors** — primary text, secondary/muted text, disabled, on-primary
- **Border colors**
- **Dark mode variants** — if the project supports dark mode, show the dark-mode counterparts

If colors are defined as CSS variables (`--primary: 222 47% 11%`), record both the variable name and its resolved value. If they reference a Tailwind palette (e.g., `colors.blue[600]`), resolve and record the hex.

### 3b — Typography

Extract:

- **Font families** — primary (body), heading/display, monospace (code). Include the CSS variable or Tailwind key used.
- **Font sizes** — the full scale if defined in Tailwind or a theme file (xs, sm, base, lg, xl, 2xl, …). Include px/rem values.
- **Font weights** — which weights are used (regular, medium, semibold, bold)
- **Line heights** — if customized from defaults
- **Letter spacing** — if customized

### 3c — Spacing and layout

Extract:

- **Spacing scale** — if customized in Tailwind or a theme (list key → value pairs)
- **Container / max-width** — the main content container width(s)
- **Breakpoints** — all responsive breakpoints (sm, md, lg, xl, 2xl or custom names) with their pixel values

### 3d — Visual style tokens

Extract:

- **Border radius** — all defined values (none, sm, md, lg, xl, full, etc.) and which one is used most (the "default" rounding)
- **Box shadows / elevation** — defined shadow tokens
- **Transitions / animations** — any custom `transitionTimingFunction`, `transitionDuration`, or keyframe animations defined in the config

### 3e — Design system and component library

Based on what was found in Step 2c, read the relevant config and entry files. Apply the matching instructions below; if multiple libraries are present, cover each one.

**shadcn/ui**
- Read `components.json`: note `style` (default vs new-york), `baseColor`, `cssVariables` flag
- List all components found in the UI components directory (names only)
- Note whether theming is CSS-variable-based or direct utility-class-based

**MUI (React) / Angular Material / Vuetify / PrimeVue / similar token-driven library**
- Find the theme/provider setup file (e.g., `createTheme`, `definePreset`, `vuetify.config.*`, `angular.json` theme entry)
- Extract: primary and accent palette, typography config, border radius / shape config
- Note the library version

**Tailwind plugin libraries (daisyUI, Flowbite, etc.)**
- Read `tailwind.config.*` for the plugin entry and any theme overrides it introduces
- List configured themes (e.g., daisyUI themes array)

**CSS framework without JS (Bootstrap, Bulma, etc.)**
- Identify how the library is imported (CDN link, npm import, SCSS entry)
- Note any variable overrides (e.g., `_variables.scss` customizing Bootstrap tokens)

**Shoelace / web components**
- Note the base URL or npm package, and where CSS custom property overrides are defined

**Custom or no library**
- Describe where shared UI components live, how they are structured, and what primitives exist

### 3f — Dark mode strategy

Determine how dark mode is implemented:

- **Tailwind `darkMode: 'class'`** — dark mode toggled via a class on `<html>` or `<body>` (note the class name, often `dark`)
- **Tailwind `darkMode: 'media'`** — follows OS preference via `prefers-color-scheme`
- **CSS variables swap** — light/dark values swapped via `:root` vs `.dark` selectors
- **No dark mode** — only one theme

### 3g — Component patterns

Scan for the main components directory (`src/components/`, `components/`, `app/components/`, `lib/components/`, or equivalent detected from the framework). Use Glob to list what exists and Grep to spot patterns — do not read every file.

Identify:
- **Directory structure** — flat vs feature-grouped vs atomic (atoms/molecules/organisms)
- **Naming conventions** — casing of filenames and directories, use of index files / barrel exports, co-located style files
- **Component format** — Single-File Components (`.vue`, `.svelte`), class-based (Angular), function-based (React/Solid/Preact), template + TS (Angular), plain HTML + JS, etc.
- **Variant system** — how component variants are expressed: utility classes toggled via a helper (`cva`, `clsx`, `cx`, `twMerge`), props mapped to CSS classes, SCSS mixins, CSS custom properties, or a JS object map
- **Typical component anatomy** — read 2–3 representative leaf components (Button, Input, Card or equivalent) and describe in prose how they are written: where props/types are declared, how styles are applied, how variants or states are handled. Quote the actual file format — do not assume a specific framework pattern.

---

## Step 4 — Write or update DESIGN.md

### If DESIGN.md does not exist → write from scratch

Write `DESIGN.md` at the project root using the structure below. Populate every section with actual values extracted in Step 3. If a section is genuinely absent from the project (e.g., no dark mode, no custom spacing), write a brief "Not configured" note rather than omitting the section.

Use code blocks for token tables and config snippets. Keep prose tight — this file is read by AI agents, not humans.

### If DESIGN.md already exists → compare, improve, and overwrite

Before writing anything, compare the existing file against the freshly extracted data from Step 3. Go section by section and identify:

- **Stale values** — token names, hex values, font names, or library versions in the file that no longer match what the codebase actually contains
- **Missing sections** — sections present in the template below that do not exist in the current file
- **Incomplete sections** — sections that exist but are left as placeholder comments or contain less detail than what Step 3 produced
- **New findings** — information extracted in Step 3 that was not in the existing file at all (e.g., a new icon library was added, dark mode was implemented since the last run)

Then write the fully updated file — same structure as below, with all extracted data merged in and all issues above resolved. Do not preserve stale content; replace it with accurate values. Do not delete sections that contain hand-written context not derivable from the scan — preserve and integrate them.

After writing, list every change made in the Step 5 summary (see below).

```markdown
# Design System

> Auto-generated by `/design-expert`. Edit manually to add context the scan could not infer.

## Design Stack

- **Styling approach:** <!-- e.g., Tailwind CSS v3.4 + CSS variables -->
- **Component library:** <!-- e.g., shadcn/ui (new-york style) -->
- **Icon library:** <!-- e.g., Lucide React -->
- **Font loading:** <!-- e.g., Google Fonts via <link>, @fontsource/inter, next/font, nuxt-fonts -->

---

## Color System

### Brand / Primary

| Token | Light | Dark |
|-------|-------|------|
| `--primary` | `#...` | `#...` |
| ... | | |

### Neutrals

| Token | Value |
|-------|-------|
| ... | |

### Semantic

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--destructive` | | | Errors, delete actions |
| ... | | | |

### Usage rules
<!-- How to use color in this project — e.g., "Always use CSS variables, never raw hex. Background surfaces use --background and --card." -->

---

## Typography

### Font Families

| Role | Family | CSS variable / Tailwind key |
|------|--------|----------------------------|
| Body | Inter | `--font-sans` / `font-sans` |
| Mono | JetBrains Mono | `--font-mono` / `font-mono` |

### Type Scale

| Key | Size | Line height | Usage |
|-----|------|-------------|-------|
| xs | 12px / 0.75rem | 1rem | Captions, labels |
| sm | 14px / 0.875rem | 1.25rem | Secondary text |
| base | 16px / 1rem | 1.5rem | Body text |
| ... | | | |

### Font weights in use
<!-- e.g., 400 (normal), 500 (medium), 600 (semibold), 700 (bold) -->

---

## Spacing & Layout

### Container

<!-- e.g., max-width: 1280px, centered with px-4 sm:px-6 lg:px-8 -->

### Breakpoints

| Name | Min-width |
|------|-----------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

### Spacing scale
<!-- Note only if customized from Tailwind defaults. Otherwise write "Tailwind default spacing scale." -->

---

## Visual Tokens

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.5rem` | Default radius for cards, inputs, buttons |
| ... | | |

### Shadows

<!-- List defined shadow tokens or write "Tailwind default shadows." -->

### Transitions

<!-- e.g., "Standard transition: 150ms ease-in-out on interactive elements. Defined via Tailwind's transition-* utilities." -->

---

## Dark Mode

- **Strategy:** <!-- class / media / none -->
- **Toggle class:** <!-- e.g., `.dark` on <html> -->
- **Implementation:** <!-- e.g., "CSS variables for all color tokens. Light values in :root, dark values in .dark { ... }" -->

---

## Component Library Details

<!-- Expand based on what was found. Examples: -->

### shadcn/ui
- Style: <!-- default | new-york -->
- Base color: <!-- slate | gray | zinc | neutral | stone -->
- CSS variables: <!-- true | false -->
- Components present: <!-- comma-separated list from src/components/ui/ -->

---

## Component Patterns

### Directory structure
<!-- e.g., src/components/ui/ (shadcn primitives), src/components/ (product components), src/features/**/ (feature-scoped components) -->

### Naming conventions
<!-- e.g., PascalCase filenames, kebab-case directories, index.ts barrel files -->

### Variant system
<!-- Describe how variants are expressed in this project — e.g.:
  - CVA (class-variance-authority) + cn() helper — React/Tailwind projects
  - SCSS mixins / BEM modifiers — CSS-heavy projects
  - Props mapped to CSS custom property values — web component projects
  - defineProps + :class binding — Vue SFC projects
  - @HostBinding / @Input — Angular projects
-->

### Typical component anatomy
<!-- Describe in prose (no assumed framework) how a representative leaf component is structured.
Include: where props/types are declared, how styles are applied, how variants or states are handled.
Paste a short snippet from an actual file in this codebase as the canonical example. -->

---

## Rules for AI Agents

<!-- Auto-generated summary of what an AI agent MUST follow when writing UI code for this project. Adjust after generation if needed. -->

1. **Color:** Always use the project's color tokens (CSS variables, theme values, or utility classes) — never hardcode raw hex/rgb values.
2. **Spacing:** Use the project's spacing system (utility classes, theme scale, or CSS variables) — never use arbitrary inline values unless the system provides no alternative.
3. **Components:** Reuse existing components from the UI components directory before creating new primitives.
4. **Variants:** Extend the established variant system (CVA, SCSS mixins, prop-to-class maps, etc.) — do not bypass it with one-off overrides.
5. **Dark mode:** Every color choice must work in both light and dark mode (if applicable). Use tokens that swap automatically.
6. **Typography:** Use the defined type scale — avoid arbitrary sizes outside the established scale.
7. **Icons:** Use only the detected icon library for consistency — do not mix icon sets.
```

---

## Step 5 — Confirm to the user

After writing `DESIGN.md`, report:

- What design system / styling approach was detected
- Which color tokens, font families, and component library were documented
- Any sections left as "Not configured" because they were genuinely absent
- Any ambiguities where the scan produced uncertain results (e.g., "Colors found in both tailwind.config.ts and globals.css — CSS variables take precedence per the shadcn/ui setup")
- Suggest running `/init-project` first if `AGENTS.md` was missing and the scan had to work without stack context

**If DESIGN.md already existed**, also report a changelog of every improvement made:

```
## DESIGN.md updated

### Updated (stale → current)
- <section>: <what changed> (e.g., "Color System: --primary was #3b82f6, now #2563eb after theme change")

### Added (new information)
- <section>: <what was added> (e.g., "Dark Mode section added — project now uses class-based dark mode")

### Completed (was placeholder → now populated)
- <section>: <what was filled in> (e.g., "Component Patterns: Variant system was empty, now documents CVA usage")

### Preserved (hand-written content kept as-is)
- <section>: <what was kept> (e.g., "Rules for AI Agents: custom rule 8 kept unchanged")

### No changes needed
- <section>: <what was already accurate>
```
