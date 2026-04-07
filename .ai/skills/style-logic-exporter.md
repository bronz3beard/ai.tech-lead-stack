---
name: style-logic-exporter
description:
  Extracts design tokens and style logic from code for design-to-code alignment.
cost: ~550 tokens
---

# Style Logic Exporter (The Design Bridge)

> [!TIP] **Figma-First Logic**: This skill bridges the gap between raw
> CSS/Tailwind and Figma Make prompts. Focus on extracting re-usable tokens over
> one-off styles. [!IMPORTANT] **Diagnosis before Advice**: Every extraction
> begins with **Tech-Stack Discovery**. Identify the project's styling engine
> (Tailwind, CSS Modules, Styled Components, etc.) before analyzing patterns.
> Follow **G-Stack Ethos**.

## 🎯 Logic Extraction Workflow

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action:** Scan root configuration files for styling dependencies.
- **Goal:** Identify the styling engine and primary configuration
  source-of-truth.

### Phase 1: Style & Component Discovery

- **Action:** Scan the codebase for style definitions AND component
  architecture.
- **Priority:** Seek out design systems, Storybook configs, and primary UI
  directories.
- **Targets:** Config files (e.g., `tailwind.config`, `theme.ts`), global CSS
  entry points, and component-level style files.

### Phase 2: Pattern Identification

- **Action:** Identify standardized values across the codebase.
- **Heuristics:**
  - **Syntax Compliance:** Track the most common utility prefixes or property
    patterns (e.g., `text-primary-*`, `--clr-brand`, `styled.div`).
  - **Composition:** Analyze how atomic styles are grouped to build UI elements
    (Cards, Buttons, Layouts).
  - **Scale Scaling:** Map spacing, radius, and typography scales to their
    implementation equivalents.
  - **Anti-Patterns:** Identify inline styles or arbitrary values that avoid the
    system.

### Phase 3: Documentation Translation

- **Action:** Format the extracted logic into a concise instruction block.
- **Outcome:** A "Design System Instruction Block" for a designer or architect.

## 🛠 Outcome Actions

Output a "System Specification Block":

"Designer/Developer, use these system values to match the codebase:

- Brand Colors: [List Values] (Mapped to: [Ecosystem Property])
- Standard Radius: [Value] (Mapped to: [Ecosystem Property])
- Spacing Scale: [Scale] (Mapped to: [Ecosystem Property])
- Common Compositions: [Standards for Cards/Buttons]
- System Deviations: [What to avoid]"

## 🔍 Critical Patterns to Detect

- **Source of Truth:** Prioritize the project's primary config (e.g., Detected
  Config File) over ad-hoc component styles.
- **Normalization:** Convert units (px, rem, hsl) to the project's preferred
  format.
