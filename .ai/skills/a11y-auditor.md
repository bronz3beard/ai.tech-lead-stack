---
name: a11y-auditor
description: Audits code, components, or screenshots for accessibility barriers following WCAG 2.2 (Levels A, AA, AAA). Detects the environment automatically and runs only the relevant checks — Web (HTML, React, Next.js, Tailwind) or Mobile (React Native, Expo, Swift, Kotlin).
argument-hint: [--level <A|AA|AAA>]
allowed-tools: Read Grep Glob Bash
effort: high
cost: ~2500 tokens
---

# a11y-auditor

**Role:** Senior Digital Accessibility Engineer (CPACC certified).  
**Standard:** WCAG 2.2 — Levels A, AA, and AAA.  
**Goal:** Identify accessibility barriers in the provided code, components, or screenshots and deliver actionable, criteria-referenced findings.

## Usage

**Audit at default level (AA):**
```
/a11y-auditor
```

**Audit at a specific conformance level:**
```
/a11y-auditor --level A
/a11y-auditor --level AA
/a11y-auditor --level AAA
```

> If `--level` is not provided, default to **AA** (the standard legal and compliance baseline).

---

## Step 1 — Resolve Conformance Level

Parse `$ARGUMENTS` for `--level`. Accepted values: `A`, `AA`, `AAA`.  
If not provided, use `AA`.  
If an invalid value is given, inform the user and provide the list of available levels to choose.

---

## Step 2 — Environment Detection

Read `AGENTS.md` at the project root to determine the environment. It is the single source of truth for the stack — do not infer from file extensions or imports.

**If `AGENTS.md` exists:**
- Read the `## Stack` section.
- Classify as **Web** if the framework is any of: HTML, React, Next.js, Remix, Astro, Nuxt, Svelte, Angular, or any browser-targeting stack.
- Classify as **Mobile** if the framework is any of: React Native, Expo, Swift, SwiftUI, Kotlin, Jetpack Compose, or Flutter.
- If the stack targets both (e.g., Expo Web), classify as **Web** and note the dual-target nature in the report.

**If `AGENTS.md` does not exist:**
Stop and inform the user:

> `AGENTS.md` was not found. Environment detection without it risks hallucinating the wrong stack and producing an inaccurate audit.
> Run `/init-project` first to scan the project and generate `AGENTS.md`, then re-run `/a11y-auditor`.

Once classified, **execute only the corresponding section below**. Skip the other entirely.

---

## Web Audit

### Perceivable

**1.1 — Text Alternatives (A)**
- Every `<img>` has a meaningful `alt`. Decorative images use `alt=""`.
- Icon-only buttons/links have accessible text via `aria-label`, `aria-labelledby`, or visually hidden text.
- SVGs used as content have `<title>` and `role="img"`.

**1.2 — Time-based Media (A/AA)**
- `<video>` and `<audio>` elements have captions (A) and audio descriptions (AA).
- Pre-recorded media is not the sole means of conveying information.

**1.3 — Adaptable (A)**
- Semantic HTML is used: headings (`h1–h6`), landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`), lists (`<ul>`, `<ol>`), and form elements (`<label>`, `<fieldset>`, `<legend>`).
- Reading and operation order makes sense when CSS is disabled.
- Instructions do not rely solely on sensory characteristics (shape, color, position).
- No `orientation` lock without programmatic necessity. *(2.2 new — 1.3.4 AA)*
- Input fields have correct `autocomplete` attributes. *(2.1 — 1.3.5 AA)*

**1.4 — Distinguishable (A/AA/AAA)**
- Color is not the only visual means of conveying information. *(A)*
- Normal text contrast ≥ 4.5:1, large text ≥ 3:1. *(AA)*  
  AAA: normal ≥ 7:1, large ≥ 4.5:1.
- Text can be resized to 200% without loss of content or functionality. *(AA)*
- No text in images except logos. *(AA)*
- Content reflows at 320px viewport width without horizontal scrolling. *(2.1 — 1.4.10 AA)*
- Non-text contrast (UI components, focus indicators) ≥ 3:1 against adjacent colors. *(2.1 — 1.4.11 AA)*
- Text spacing can be overridden (line height ≥ 1.5×, letter spacing ≥ 0.12em, word spacing ≥ 0.16em) without content loss. *(2.1 — 1.4.12 AA)*
- Content on hover/focus is dismissible, hoverable, and persistent. *(2.1 — 1.4.13 AA)*

### Operable

**2.1 — Keyboard Accessible (A)**
- All interactive elements are reachable and operable by keyboard alone.
- No keyboard traps.
- Keyboard shortcuts using single characters can be turned off or remapped. *(2.1 — 2.1.4 A)*

**2.2 — Enough Time (A/AA)**
- Moving/auto-updating content can be paused, stopped, or hidden.
- No content flashes more than 3 times per second. *(A)*

**2.4 — Navigable (A/AA/AAA)**
- Skip-to-main-content link is present and functional. *(A)*
- Pages have descriptive `<title>` elements. *(A)*
- Focus order is logical and preserves meaning. *(A)*
- Link purpose is clear from link text alone or context. *(A)*
- Multiple navigation mechanisms exist (nav menu, search, sitemap). *(AA)*
- Headings and labels are descriptive. *(AA)*
- Keyboard focus indicator is visible. *(AA)* *(2.2 enhanced — 2.4.11 AA)*
- Focus indicator has sufficient area and contrast. *(2.2 new — 2.4.11/2.4.12 AA/AAA)*

**2.5 — Input Modalities (A/AA)** *(WCAG 2.1+)*
- Pointer gestures have single-pointer alternatives. *(A)*
- No accidental activation on pointer down events (pointer cancellation). *(A)*
- Labels match accessible names for voice control compatibility. *(A)*
- Motion-based input has a UI alternative and can be disabled. *(A)*
- Target size for interactive elements ≥ 24×24 CSS px. *(2.2 new — 2.5.8 AA)*

### Understandable

**3.1 — Readable (A/AA)**
- `<html lang="...">` is set and correct. *(A)*
- Language changes within a page use `lang` attribute. *(AA)*

**3.2 — Predictable (A/AA)**
- No context changes on focus. *(A)*
- No context changes on input without prior warning. *(A)*
- Consistent navigation order and component labeling across pages. *(AA)*

**3.3 — Input Assistance (A/AA)**
- Errors are identified in text and described to the user. *(A)*
- Labels or instructions are provided for user input. *(A)*
- Error suggestions are offered when known. *(AA)*
- Legal/financial forms allow review and correction before submission. *(AA)*

### Robust

**4.1 — Compatible (A)**
- HTML is valid (no duplicate IDs, no broken nesting that affects AT).
- All UI components have `name`, `role`, and `value` exposed correctly via ARIA or native semantics.
- Status messages are announced without receiving focus (`role="status"`, `role="alert"`, `aria-live`). *(2.1 — 4.1.3 AA)*

---

## Mobile Audit

### React Native / Expo

**Perceivable**
- All `<Image>` components have `accessible={true}` and a meaningful `accessibilityLabel`. Decorative images use `accessibilityElementsHidden={true}` (iOS) or `importantForAccessibility="no"` (Android).
- Custom icons and icon buttons have `accessibilityLabel` and `accessibilityRole="button"`.
- Color is not the only visual means to convey state.
- Text contrast meets ≥ 4.5:1 (normal) and ≥ 3:1 (large) against its background.
- Text scales correctly with system font size settings; no hardcoded `fontSize` that ignores `allowFontScaling`.

**Operable**
- Touchable elements (`TouchableOpacity`, `Pressable`, `TouchableHighlight`) have a minimum touch target of **44×44 pt** (iOS HIG) / **48×48 dp** (Material Design).
- Custom gestures have a single-tap alternative.
- No content requires timed interaction without a way to extend or disable the timer.
- Animations respect the `reduceMotion` accessibility setting:
  ```js
  import { AccessibilityInfo } from 'react-native';
  AccessibilityInfo.isReduceMotionEnabled();
  ```

**Understandable**
- `accessibilityRole` is set correctly on all interactive and semantic elements (`button`, `link`, `header`, `image`, `text`, `checkbox`, `radio`, `tab`, `none`).
- `accessibilityState` reflects current state: `{ disabled, selected, checked, busy, expanded }`.
- `accessibilityHint` is used to clarify non-obvious actions (not to repeat the label).
- Form inputs have associated labels. Use `accessibilityLabelledBy` (RN 0.71+) or combine label + input in an accessible group.
- Error messages are announced via `AccessibilityInfo.announceForAccessibility()`.

**Robust**
- Logical reading order is enforced with `accessibilityViewIsModal` for modals and `importantForAccessibility="yes"` / `accessibilityElementsHidden` to manage focus scope.
- Avoid `pointerEvents="none"` on elements that need to be reachable by screen readers.
- Test with VoiceOver (iOS) and TalkBack (Android) — not just automated tools.

### Swift (iOS Native)

- All `UIView` subclasses that convey information set `isAccessibilityElement = true` and a meaningful `accessibilityLabel`.
- `accessibilityTraits` correctly reflect element type (`.button`, `.header`, `.link`, `.image`, `.selected`, `.notEnabled`).
- `accessibilityHint` describes the result of an action, not the action itself.
- Dynamic Type is supported: use `UIFont.preferredFont(forTextStyle:)` and enable `adjustsFontForContentSizeCategory = true`.
- Minimum touch target: 44×44 pt.
- Reduce Motion is respected: check `UIAccessibility.isReduceMotionEnabled`.
- Custom actions use `UIAccessibilityCustomAction` instead of gesture-only interactions.

### Kotlin / Android Native

- All interactive `View` elements have `contentDescription` set.
- `ViewCompat.setAccessibilityDelegate` is used for custom roles and actions.
- `importantForAccessibility` is set to `yes` or `no` explicitly on decorative elements.
- Minimum touch target: 48×48 dp.
- Reduce Motion: check `Settings.Global.TRANSITION_ANIMATION_SCALE == 0`.
- `AccessibilityNodeInfo` is configured for custom views using `ViewCompat.setAccessibilityDelegate`.

---

## Step 3 — Report Findings

Output findings using this structure:

```
## A11y Audit Report

**Environment:** Web | Mobile (<platform>)
**Conformance Level:** A | AA | AAA
**Files / Components Reviewed:** <list>

---

### ❌ Violations
| WCAG | Level | Issue | Location | Fix |
|------|-------|-------|----------|-----|
| 1.1.1 | A | Missing alt on <img src="hero.png"> | Hero.tsx:14 | Add alt="..." or alt="" if decorative |

### ⚠️ Warnings (manual verification needed)
| WCAG | Level | Issue | Location | Notes |
|------|-------|-------|----------|-------|

### ✅ Passed
- <criterion and what was verified>

---

### Summary
- **Violations:** X
- **Warnings:** X
- **Passed:** X
- **Overall:** Fails / Passes Level <target>

### Recommended Next Steps
1. <highest priority fix>
2. ...
```

**Severity ordering:** Report violations from most to least impactful — screen reader blockers first, then keyboard, then visual/contrast, then AAA enhancements.

If automated tooling is available in the project (`axe-core`, `eslint-plugin-jsx-a11y`, `@testing-library/jest-dom`), note which violations could be caught automatically vs. those requiring manual testing.

---

## Step 4 — Export

After displaying the report, use `AskUserQuestion` to ask:

**Question 1 — Export to file?**
- Question: "Would you like to export this audit report as a Markdown file?"
- Header: "Export report"
- Options:
  - `Yes` — export the report to a `.md` file
  - `No` — finish here, no file written

If the user selects **No**, stop here.

**Question 2 — Export location?** *(only if Yes was selected)*
- Question: "Where should the report be saved?"
- Header: "Export location"
- Options:
  - `Default (docs/)` — save to `docs/a11y-audit-report.md` at the project root
  - `Custom path` — let me type the path

If the user selects **Custom path**, ask them to provide it as free text via the "Other" input.

Once the path is confirmed:
- Resolve it relative to the project root.
- If the target directory does not exist, create it before writing.
- Write the full report content (exactly as displayed in Step 3) to the file.
- Confirm to the user: `Report saved to <resolved-path>`.
