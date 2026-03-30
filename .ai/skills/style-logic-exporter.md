---
name: style-logic-exporter
description:
  Extracts design tokens (colors, spacing, radii) and style logic from code for
  Figma translation.
cost: ~500 tokens
---

# Style Logic Exporter (The Design Bridge)

> [!TIP] **Figma-First Logic**: This skill bridges the gap between raw
> CSS/Tailwind and Figma Make prompts. Focus on extracting re-usable tokens over
> one-off styles.

## 🎯 Logic Extraction Workflow

### Phase 1: Style & Component Discovery

- **Action:** Scan the codebase for style definitions AND component
  architecture.
- **Priority:** Proactively seek out isolated design systems (e.g., libraries,
  monorepo packages), Storybook configurations (`.storybook/`), and primary
  `components/` directories before deep-diving into individual CSS files.
- **Targets:** `globals.css`, `tailwind.config.{js,ts,mjs}`, Storybook configs,
  dedicated UI packages/folders, and component-level `main.css` files.
- **Outcome:** List of files and directories containing the source of truth for
  the design system and component logic.

### Phase 2: Pattern Identification

- **Action:** Identify the most frequent and standardized values across the
  files, focusing heavily on utility class usage.
- **Heuristics:**
  - **Tailwind Syntax:** Track the most common utility prefixes (e.g.,
    `text-primary-*`, `bg-slate-*`, `rounded-*`, `p-*`, `m-*`).
  - **Component Composition:** Analyze how utility classes are grouped to build
    larger UI elements (e.g., identifying standard button styles, card layouts,
    and typical flex/grid row compositions).
  - **Colors:** Identify hardcoded Hex codes vs. CSS variables vs. Tailwind
    theme colors.
  - **Radius/Spacing:** Map standard Tailwind steps (e.g., `p-4` = 16px) to
    their pixel equivalents for the designer.
  - **Forbidden Patterns:** Find inconsistent or "anti-pattern" styles (e.g.,
    inline styles `style={{...}}`, arbitrary Tailwind values like `w-[31px]`).

### Phase 3: Figma Translation

- **Action:** Format the extracted logic into a concise instruction block for a
  designer.
- **Standard:** Use the "Figma Make" compatible format below.

## 🛠 Outcome Actions

Output a "Figma Make Instruction Block":

"Designer, use these values in your Figma Make prompts to match the codebase:

- Brand Colors: [List Hex] (Mapped to Tailwind: e.g., bg-primary-500)
- Standard Radius: [Value in px] (Mapped to Tailwind: e.g., rounded-md)
- Spacing Scale: [e.g., 8px base] (Mapped to Tailwind: e.g., gap-2, p-4)
- Common Compositions: [e.g., Cards usually use 'p-4 rounded-lg border
  border-gray-200']
- Forbidden Patterns: [e.g., Avoid custom hex codes, avoid shadows larger than
  'shadow-md']"

## 🔍 Critical Patterns to Detect

- **G-Stack Compliance:** If Tailwind is present, prioritize Tailwind's config
  as the source of truth.
- **Normalization:** Convert HSL/RGB to Hex if required by the designer's
  workflow.
