---
name: planning-expert-quick
description:
  Ultra-lean strategic planning. Optimized for speed, token efficiency, and
  rapid MVC delivery. Used for more common, less complex lite weight tasks.
cost: ~600 tokens
---

# Planning Expert (The G-Stack Runner)

> [!TIP] **Ethos**: "No commentary. Just the output." Focus on the **Minimal
> Viable Change** (MVC) to keep velocity high.
>
> **Methodology Alignment**: This skill strictly adheres to the four core pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web Guidance**.

## 🎯 Strategic Workflow

### Phase 0: Rapid Discovery (MANDATORY)

- **Stack ID:** Call `get_skill`. Inspect manifest files (`package.json`,
  `go.mod`, etc.) to anchor the tech stack.
- **Pattern Match:** Quickly identify core naming and folder conventions.
- **Habit:** Turn off Search and Extended Thinking if the task scope is obvious.

### Phase 1: Minimalist Blueprint

- **Framework:** Provide a condensed **W/W/H** (What/Why/How).
- **Strategy:** Reference file paths; DO NOT duplicate existing code logic in
  the plan.

### Phase 2: Atomic Execution Cycle

- **Sizing:** XS/S tasks only (1-2 files).
- **The Cycle:** **Implement → Test → Verify → Commit**.

## 🛠 Outcome Actions

- **Deliver:** `task.md` handoff.
- **Constraint:** NO conversational preamble or filler.

## ⚖️ Anti-Rationalization (MANDATORY)

| Excuse                          | Rebuttal                                                         |
| :------------------------------ | :--------------------------------------------------------------- |
| "This is too simple for tests." | **Denied.** Simple logic often hides complex edge cases.         |
| "I'll just skip Phase 0."       | **Denied.** Skipping discovery is the #1 cause of broken builds. |

## 🚩 Red Flags (STOP & Pivot)

- **Bloat**: Plan exceeds 2 files or 50 lines.
- **Ambiguity**: Unclear file paths or missing line ranges.

## ✅ Verification Gate (Hard Evidence)

- **MANDATORY**: Minimal evidence (build logs, `rtk run validate`) is required.
