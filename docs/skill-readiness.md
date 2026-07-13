# Skills Readiness — What Changed and Why

> **File location after manual install:**
> `docs/designs/skills-readiness-README.md` This document explains the changes
> introduced in PR #74 (Skills Readiness Pass). It is written for two audiences:
> a developer who has never worked with this codebase before, and an AI agent
> encountering these files for the first time.

---

## Table of Contents

1. [The problem this solved](#1-the-problem-this-solved)
2. [The three new frontmatter fields](#2-the-three-new-frontmatter-fields)
3. [The Runtime modes section](#3-the-runtime-modes-section)
4. [The generate-skill-registry script](#4-the-generate-skill-registry-script)
5. [The validator upgrade](#5-the-validator-upgrade)
6. [The three targeted fixes (F3, F4, F5)](#6-the-three-targeted-fixes-f3-f4-f5)
7. [The skill template update](#7-the-skill-template-update)
8. [Who this affects and how](#8-who-this-affects-and-how)
9. [The one known limitation](#9-the-one-known-limitation)
10. [How to add a new skill after this PR](#10-how-to-add-a-new-skill-after-this-pr)

---

## 1. The problem this solved

Before this PR, the skill discovery situation was broken in three different ways
depending on where you were working:

**In an MCP-connected IDE** (Antigravity, Cursor, Continue, VS Code with the
tech-lead-stack MCP server): the server globs `.ai/skills/*.md` on every call to
`get_skills` or `list_skills`, so the agent could see all 29 skills. This
worked.

**In Cursor via the manifest**: Cursor installs skills by reading
`.ai/cursor-skills.manifest`. Before this PR, that file listed only 19 of the 29
skills. Ten skills were invisible to Cursor — including `feature-orchestrator`
(the flagship skill) and `reflexion-loop`. An agent using Cursor would never see
them.

**In the README skill table**: the table listed 19 skills. No human reading the
documentation would know the other ten existed.

**In any AI agent reading the skill files directly**: 21 of 29 skills had no
information about what they could do in read-only chat versus a write-capable
IDE. An agent had to guess. In some cases, a skill that required file writes
(and therefore would silently fail in a read-only context) looked identical to
one that worked purely as an advisor.

On top of this, three specific skills had content problems: `knowledge-manager`
hardcoded a local file-system path as though it were the only storage interface,
two skills had no verification gate (violating Pillar 3), and one skill had a
`cost` field in the wrong format.

**The core consequence of all this:** the skill catalog was fragmented. Three
different surfaces — MCP server, Cursor manifest, and README — each showed a
different subset of the same skills, and none of them matched. The manifest and
README table were maintained by hand, which meant they drifted the moment anyone
added or changed a skill.

This PR fixed all of it.

---

## 2. The three new frontmatter fields

Every skill file in `.ai/skills/` now has two new fields at the top of its YAML
frontmatter block, and the `cost` field has a stricter enforced format.

### `modes`

```yaml
modes: [read-only, write, mcp]
```

This is a list. The valid values are `read-only`, `write`, and `mcp`. Every
skill includes `read-only` — that is enforced by the validator and is
non-negotiable. The other two are additive:

- `write` means the skill can edit files, run commands, or make changes to the
  project. A skill with only `read-only` and not `write` is purely advisory — it
  produces plans, blueprints, analyses, and advice, but never touches files.
- `mcp` means the skill requires MCP tool calls — specifically tools like
  `get_skill`, `list_skills`, `verify_mission_alignment`, or the Knowledge Item
  tools. A skill that only needs to read files and the agent's context does not
  need `mcp`. One that calls `create_knowledge_item` does.

The value of this field is that it is now **machine-readable**. Before this PR,
the distinction between "this skill edits files" and "this skill only advises"
existed only in the prose of the skill body — an agent had to read and interpret
natural language to figure it out, and could get it wrong. After this PR, the
`dev-team-orchestrator` and any other routing skill can check `modes` before
invoking a chained skill, and deterministically decide whether to invoke it or
skip it based on the current execution context.

### `surface`

```yaml
surface: public
# or
surface: internal
```

This field classifies whether the skill is intended for end users and general
agents (`public`), or whether it is support infrastructure consumed by other
skills or internal tooling (`internal`).

The practical consequence: the `generate-skill-registry` script (see below) only
places `public` skills in the Cursor manifest and in the main README skill
table. `internal` skills appear in a separate smaller table at the bottom of the
README. This means Cursor's skill picker stays clean — it shows the skills a
developer would invoke deliberately, not the plumbing.

The seven internal skills after this PR are: `agent-optimizer`,
`codebase-onboarding-intelligence`, `knowledge-manager`, `mission-control`,
`operational-boundaries`, `verification-auditor`, and
`weekly-leadership-report`.

### `cost`

```yaml
cost: ~450 tokens
```

The `cost` field existed before this PR, but its format was inconsistent — some
files had `~400 tokens`, some had `~400tokens`, some had other variations. The
validator now enforces a strict regex: the value must match `~N tokens` exactly
(a tilde, a number, a space, the word "tokens"). Any other format fails
validation.

This matters because `cost` is the mechanism by which an orchestrating agent can
estimate the token budget of a plan before executing it. If ten skills are
chained in a workflow and each has a `cost` field, the orchestrator can sum them
and decide whether to proceed or warn the user. That only works if the format is
consistent and parseable.

---

## 3. The Runtime modes section

Every skill now has a `## Runtime modes` section immediately after the skill
title. It is one or two sentences and follows this pattern (taken directly from
`feature-orchestrator`, which was the house model):

```
## Runtime modes
Produces a verifiable implementation blueprint in read-only chat, and executes
+ verifies the implement phase in an IDE/MCP agent.
```

The first sentence describes what the skill delivers in read-only chat (the web
UI, or any agent session without file-write access). The second describes what
it additionally does when running in a write-capable IDE agent.

**Why this matters for a human:** it tells you immediately whether you can use
this skill in the Claude web UI for a planning conversation, or whether you need
to open Cursor or Antigravity for it to do anything useful.

**Why this matters for an agent:** it gives the agent a natural language
statement of capability at the top of the file, before it has to read the full
instructions. An agent doing a quick capability check does not need to parse the
entire skill body — the Runtime modes section tells it what it needs to know in
one sentence.

This section is intentional about not naming specific agent brands in the
normative sentence. "In an IDE/MCP agent" is correct regardless of whether the
agent is Antigravity, Cursor, Continue, Claude Code, or anything else.
Compatibility notes ("tested in Antigravity, Cursor") belong on a separate line
if the skill already had them.

---

## 4. The generate-skill-registry script

**File:** `scripts/generate-skill-registry.ts` **Run with:**
`npm run generate:registry`

This is the most important new piece of infrastructure in this PR. It eliminates
the class of problem where the manifest, the README table, and the actual skill
files disagree with each other.

### What it does

The script reads every `.md` file in `.ai/skills/`, parses the YAML frontmatter
using `gray-matter`, validates it against a Zod schema, and then generates two
outputs:

**1. `.ai/cursor-skills.manifest`** — regenerated completely from frontmatter.
Only skills with `surface: public` are written to the skills section. All
workflow files from `.agents/workflows/` are included below them with the
`workflow-` prefix convention. The header comments are preserved.

**2. The README skills table** — the script finds the
`<!-- SKILLS_TABLE:START -->` and `<!-- SKILLS_TABLE:END -->` markers in
`README.md` and replaces everything between them with a freshly generated table.
The table now has a Modes column. Public skills get the full five-column table
(Skill, Description, How it works, Use Case, Modes, Est. Context Footprint).
Internal skills get a smaller table underneath with four columns (no How it
works or Use Case).

### Why this approach

Before this PR, both the manifest and the README table were maintained by hand.
Every time a new skill was added, a developer had to remember to update two
separate files in two different formats. Both routinely drifted.

After this PR, neither file is hand-edited. They are **generated artifacts**.
The source of truth is the skill frontmatter. Running `generate:registry` is the
only correct way to update them. The validator enforces this — it will fail if
the committed manifest or README table does not match what the generator would
produce from the current frontmatter.

### The idempotence guarantee

Running the script twice in a row must produce zero diff. This is how you verify
it is working correctly:

```bash
npm run generate:registry
npm run generate:registry
git status --porcelain
```

The output of `git status` should be empty (no modified files). If it is not,
the script has a non-deterministic output — a bug to report. Jules verified this
in the PR and pasted the output.

### The `--check` flag

```bash
npx tsx scripts/generate-skill-registry.ts --check
```

In check mode, the script generates the manifest and README table in memory and
compares them to the committed versions. If they differ, it exits non-zero with
an error message. This is called automatically by `validate-skills.sh` at the
end of every validation run, making registry drift a CI failure rather than
something you discover when an agent can't find a skill.

---

## 5. The validator upgrade

**File:** `scripts/validate-skills.sh` **Run with:** `npm run validate:skills`

The validator existed before this PR. It checked for a frontmatter start marker,
a `name` field, a `description` field, and a `cost` field. After this PR it
checks all of the above plus:

- `cost` format: must match `~N tokens` exactly (enforced by regex, not just
  field presence)
- `modes` presence and validity: must be present; every value in the list must
  be one of `read-only`, `write`, `mcp`; `read-only` must be in the list
- `surface` presence and validity: must be present; must be exactly `public` or
  `internal`
- Registry drift: calls `generate-skill-registry.ts --check` at the end; if the
  committed manifest or README table would be changed by re-running the
  generator, the validator fails

The validator outputs GitHub Actions error annotation format
(`::error file=...::`) so failures show up as inline annotations in CI rather
than buried in log output.

The combined effect: every change to a skill file is now validated for both its
own correctness (required fields, correct formats) and for its effect on the
registry (did you forget to run `generate:registry` after changing a skill's
`surface` or adding a new skill?). One command — `npm run validate:skills` —
catches both classes of error.

---

## 6. The three targeted fixes (F3, F4, F5)

These are specific content problems in three individual skill files, fixed in
the same PR because they were identified during the skills audit.

### F3 — `knowledge-manager.md`: storage path presented as the interface

**Before:** The skill described the `~/.gemini/antigravity/knowledge/` file
system path as if it were the interface for interacting with Knowledge Items. An
agent reading this skill might attempt to read/write that path directly rather
than using the MCP tools.

**After:** The skill now presents the MCP tools (`list_knowledge_items`,
`read_knowledge_item`, `create_knowledge_item`) as the interface. The path
`~/.gemini/antigravity/knowledge/` is described as a "default backend note
storage" — a technical detail about where data persists, not a thing an agent
should address directly. This is the correct abstraction: the tools are
agent-agnostic and work regardless of which MCP client is running; the file path
is Antigravity-specific implementation detail.

### F4 — `knowledge-manager.md` and `style-logic-exporter.md`: missing Verification Gate

**Before:** Neither skill had a `## Verification Gate` section. Pillar 3
(Production-Grade Ethos) requires every skill to define what hard evidence looks
like at the end of execution. Without this section, an agent using these skills
had no instruction to produce verifiable output — it could complete silently
with no evidence of what it actually did.

**After:** Both skills now have a `## Verification Gate` section that specifies
what must be pasted as evidence. For `style-logic-exporter`, this is the
exported design tokens or CLI verification output. For `knowledge-manager`, this
is a confirmation of the KI operation (create/update/read) with the relevant
item ID or content.

### F5 — `operational-boundaries.md`: `cost` field wrong format

**Before:** The `cost` field was in a format the new strict validator would
reject.

**After:** Updated to `~400 tokens`. The PR description notes Jules' token count
reasoning for the estimate.

---

## 7. The skill template update

**File:** `templates/SKILL_TEMPLATE.md`

The template is what Jules (or a human) uses as the starting point when creating
a new skill. Before this PR, a new skill created from the template would be
missing `modes` and `surface`, and would not have a `## Runtime modes` section.
It would fail validation immediately.

After this PR, the template includes all required fields with placeholder values
and includes the `## Runtime modes` section in the correct position. Creating a
new skill from the template and running `validate:skills` will pass without any
additional changes needed to the structure.

---

## 8. Who this affects and how

**You, using the Claude web UI or any read-only chat agent:** You now get a
clear signal at the top of every skill (the Runtime modes line) telling you what
that skill can do in this context. Skills that require file writes will tell you
they operate in advisory mode in chat.

**You, using Cursor:** Before this PR, Cursor's skill picker showed 19 skills.
After this PR it shows 24 public skills plus all 26 workflow files.
`feature-orchestrator` and `reflexion-loop` — the two most important skills in
the stack — are now visible and installable in Cursor.

**You, using Antigravity or any MCP-connected IDE:** The MCP server already
globbed all skills, so you could always see all 29. What changes is that the
skills now tell agents their mode set in machine-readable frontmatter, meaning
the `dev-team-orchestrator` and similar routing skills can make deterministic
decisions about which skills to invoke based on the current execution context,
rather than guessing from prose.

**Jules and other cloud coding agents:** Any agent running via the `AGENTS.md`
standard now reads the `modes` field and knows immediately whether a skill is
safe to invoke in its execution context (cloud agent with only branch commit
access) without having to parse the full skill body.

**You, adding a new skill in the future:** You now have a one-command workflow:
add the skill, fill in the frontmatter correctly, write the body, run
`npm run generate:registry`, commit everything including the regenerated
manifest and README. Run `npm run validate:skills` to confirm. The validator
will catch format errors before CI does. See the next section for the exact
steps.

---

## 9. The one known limitation

The `generate-skill-registry.ts` script contains a hardcoded `originalRows`
object that stores the "How it works" and "Use Case" columns for the 19 existing
public skills. These columns contain human-written descriptions that were in the
old README table but are not represented in any frontmatter field.

This was a pragmatic decision: moving this data into frontmatter would have
required changing every skill's frontmatter significantly and was out of scope
for this PR. As a consequence, **adding a new public skill requires one
additional step**: add the skill's row to the `originalRows` object in
`generate-skill-registry.ts` with its "How it works" and "Use Case" text.

If you do not do this, the generated README row will show `-` in those two
columns. The skill will still appear correctly in the manifest and the Modes
column will be correct — only the README documentation columns will be
incomplete.

A future improvement would be to add `how_it_works` and `use_case` fields to the
skill frontmatter schema, removing the need for `originalRows` entirely. This
would be a non-breaking additive change to the frontmatter contract.

---

## 10. How to add a new skill after this PR

1. Copy `templates/SKILL_TEMPLATE.md` to `.ai/skills/your-skill-name.md`

2. Fill in the frontmatter:

   ```yaml
   ---
   name: your-skill-name
   description: One clear sentence describing what the skill does.
   cost: ~N tokens # estimate: count the approximate tokens in the skill body
   modes: [read-only] # add write if it edits files; add mcp if it calls MCP tools
   surface: public # or internal if it is support infrastructure
   ---
   ```

3. Write the skill body. The first section after the title must be
   `## Runtime modes` — one or two sentences, no brand names.

4. Regenerate the registry:

   ```bash
   npm run generate:registry
   ```

5. If the skill is `surface: public`, open `scripts/generate-skill-registry.ts`
   and add a row to the `originalRows` object with the skill's name as the key
   and an array of `[description, howItWorks, useCase]` as the value. Run
   `npm run generate:registry` again after editing.

6. Verify everything:

   ```bash
   npm run validate:skills
   ```

   This will catch missing fields, wrong formats, and any drift between the
   frontmatter and the committed manifest/README table.

7. Commit the skill file, the regenerated manifest, and the regenerated README
   table in one atomic commit.
