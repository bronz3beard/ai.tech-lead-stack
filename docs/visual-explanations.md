# Visual Explanations: show-it and show-it-deep

[← Back to the README](../README.md)

Two skills that answer questions about your code with **pictures instead of
paragraphs**. Ask "how does a request reach the database?" and you get a
diagram, not an essay.

Neither skill ever changes your code. The only files they create are the
pictures themselves, saved in `.ai/output/visuals/` inside your project. Git
ignores that folder, so the pictures never end up in a commit by accident.

## Which one should I use?

|                    | `show-it` (start here)                                                        | `show-it-deep`                                                                      |
| :----------------- | :---------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **What you get**   | A diagram, a mock terminal screen, a labelled screenshot, or a small web page | One interactive diagram you can search, click through, trace paths in, and export   |
| **Token cost**     | About 3,000 tokens per answer                                                 | About 9,000–14,000 tokens per diagram; up to about 30,000 if it needs to fix itself |
| **Extra setup**    | None                                                                          | Install archify once (below)                                                        |
| **Where it works** | Everywhere: coding apps, chat windows, and the web app's `/chat`              | Coding apps that can run commands (Claude Code, Cursor, Codex, and similar)         |
| **Best for**       | Most questions: flows, steps, "what calls what", "what does this command do"  | Big systems you want to explore, or share as a single file with your team           |

**Rule of thumb:** use `show-it`. Reach for `show-it-deep` only when a diagram
has so many parts that you'd want to search it or click through it. If you ask
`show-it-deep` something `show-it` could answer, it says so and asks which you'd
prefer before spending the extra tokens.

## How to use them

In Claude Code, type `/tls:show-it` or `/tls:show-it-deep` followed by your
question. In other coding apps, ask for the skill by name, for example: "use the
tech-lead-stack show-it skill to show how login works". In the web app, type
`/show-it` in `/chat`.

Examples:

- `/tls:show-it how does get_skills find a skill file?`
- `/tls:show-it what does the doctor command print?`
- `/tls:show-it-deep map the whole MCP server: tools, handlers, and storage`

Every answer ends with a **Source** line listing the files and line numbers the
picture was drawn from, so you can check it against the code.

## What show-it can draw

`show-it` picks the cheapest picture that gets the idea across, based on the
question and on what your app can do:

- **Diagrams** (mermaid) for flows, steps, and how parts connect. These show as
  pictures on GitHub, in VS Code, and in the web app.
- **Mock terminal screens** for "what does this command do?"
- **Labelled screenshots** for "what is this part of the page?" This needs an
  app that can run commands and a browser on your computer. Without them you get
  a simple text sketch of the page instead.
- **Small web pages** for comparisons and numbers, such as a bar chart. These
  have no scripts and load nothing from the internet. In the web app's chat they
  arrive as code, unless you turn on the preview: see
  [Preview web pages in the chat](web-app.md#optional-preview-web-pages-in-the-chat).

## show-it-deep's dependency: archify

`show-it-deep` cannot work without **archify**. It is the only skill in this
toolbox that depends on a tool made by someone else, so this section explains
what that tool is, exactly how the skill uses it, and why it was chosen.

| Fact                       | Detail                                                                                                    |
| :------------------------- | :-------------------------------------------------------------------------------------------------------- |
| Project                    | [github.com/tt-a1i/archify](https://github.com/tt-a1i/archify)                                            |
| Made by                    | An independent developer (GitHub user `tt-a1i`), not by Tech-Lead Stack                                   |
| Licence                    | MIT: free to use, change, and share, including at work                                                    |
| Version written against    | archify 3.0 (3.0.1 when this skill was written, October 2026)                                             |
| Needs                      | Node.js 18 or newer, and an app that can run commands                                                     |
| Who installs it            | You, once, with one command (see [Setting it up](#setting-it-up)). This toolbox never installs it for you |
| Sends data anywhere?       | No telemetry. Its optional update check is switched off whenever `show-it-deep` runs it (see below)       |
| Bundled with this toolbox? | No. See [Alternatives considered](#alternatives-considered)                                               |

### What archify does

archify turns a short, structured description of a system into a polished,
interactive diagram saved as **one HTML file**. It supports five kinds of
diagram:

- **Architecture:** components, services, storage, and the boundaries between
  them.
- **Workflow:** processes with steps, approvals, and branches, such as CI/CD or
  a runbook.
- **Sequence:** who calls whom, in order, such as an API request with a cache
  miss.
- **Data flow:** pipelines, where data comes from, what transforms it, and who
  uses it.
- **Lifecycle:** states and the moves between them, such as a job going from
  queued to running to failed or done.

The finished file lets you search for a part, focus on it, trace everything
upstream or downstream of it, follow a path between two parts, switch between
light and dark themes, and export images. Anyone can open it in a browser; they
don't need archify, an account, or an internet connection.

### How show-it-deep uses archify, step by step

1. **Guard.** It checks archify is installed, and stops straight away if not.
2. **Cost check.** If a cheaper `show-it` diagram would answer your question, it
   says so and lets you choose.
3. **Health check.** It runs archify's own `doctor` command, which reports
   anything archify needs that is missing.
4. **Read your code.** It finds the files and lines that answer your question
   and notes them as sources.
5. **Describe the diagram.** It writes a short description of the parts and
   connections in archify's format: a small JSON file, usually a few kilobytes.
6. **Build and check.** archify's `finalize` command checks that description,
   lays it out, builds the HTML, and opens it in a hidden browser to make sure
   it really displays. If a check fails, archify says exactly what is wrong, the
   agent fixes it, and tries again, within archify's own retry limit.
7. **Hand over.** You get the HTML file in `.ai/output/visuals/`, the sources it
   was drawn from, and the result of archify's checks.

### Why archify was chosen

Each reason maps to a rule this toolbox already follows:

- **The AI writes a little; archify does the heavy lifting.** The AI only writes
  the small description in step 5. archify's own program produces the roughly
  750 KB HTML file. Generating that much HTML word by word would be very slow
  and expensive.
- **Every diagram is checked, not assumed.** archify won't call a diagram
  finished until its checks pass, including a real browser check. When a check
  fails it gives a precise reason instead of a crash. That matches this
  toolbox's "evidence, not 'looks right'" rule.
- **It draws only what it's told.** archify does not invent connections to make
  a picture look complete. It can pin parts of the diagram to real files and
  line numbers. That matches the "understand the real code first" rule.
- **It works with many coding apps.** archify installs into Claude Code, Codex,
  opencode, and Cursor, so `show-it-deep` isn't tied to one AI company.
- **The result needs nothing to view.** One self-contained file you can send to
  anyone.
- **It is free and openly licensed** (MIT), with no telemetry.
- **It was the tool requested** when these skills were planned. The checks above
  are what made it acceptable to depend on.

### Alternatives considered

| Option                                    | Decision           | Why                                                                                                              |
| :---------------------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------- |
| Mermaid diagrams only                     | Kept, as `show-it` | Cheap and works everywhere, but the pictures are static: no search, no path tracing, no single shareable file    |
| Bundle archify inside this toolbox        | Rejected           | About 3 MB extra for every user, including those who never use it, and its update schedule isn't ours to control |
| One skill that switches to archify itself | Rejected           | Every answer would pay for archify instructions, and costs would become unpredictable                            |
| Other diagram tools                       | Not evaluated      | archify was the requested tool and met the requirements above; no wider comparison was made                      |

The full design record, including token-cost measurements, is in
[the show-it design document](designs/2026-10-03-show-it-visual-explanations.md).

### Risks and trade-offs

- **Someone else maintains it.** If archify changes or renames its commands in a
  future major version, `show-it-deep` may need updating. The health check and
  archify's build checks will report the problem; they won't hide it.
- **It costs more tokens.** archify's own instructions and examples are read
  during a run, which is most of the 9,000–14,000 token cost, and more when a
  diagram needs fixing.
- **It only works in coding apps.** It needs to run commands, so it can't run in
  plain chat windows or the web app's `/chat`.
- **Not yet run for real.** The skill was written from archify 3.0's own
  documentation. Treat the first runs as a trial and report anything odd as an
  [issue](https://github.com/bronz3beard/ai.tech-lead-stack/issues).

### Setting it up

**You need** Node.js 18 or newer. Check with `node -v`.

**Install it once:**

```bash
npx skills add tt-a1i/archify -g
```

This puts archify where your coding app looks for skills, for example
`~/.claude/skills/archify` for Claude Code or `~/.agents/skills/archify` for
Codex. If you put it somewhere else, `show-it-deep` stops and says it can't find
archify; tell it the folder and ask again.

**Check it works** (replace the folder if yours is different):

```bash
node ~/.claude/skills/archify/bin/archify.mjs doctor
```

### What show-it-deep does and does not do with archify

- It **never installs, updates, or removes** archify.
- **It checks for archify first, and stops straight away if it's missing.**
  Before reading any of your files or doing any other work, it runs one quick
  check that only looks for archify's folder. If archify isn't there, it stops
  and tells you why, with a link to
  [archify's GitHub page](https://github.com/tt-a1i/archify) and the install
  command. That way a missing tool costs you almost nothing. It does not quietly
  run `show-it` instead; it suggests `/show-it` and leaves the choice to you. If
  you installed archify somewhere unusual, tell it the folder and ask again.
- It runs only archify's own check (`doctor`), its type suggester (`guide`), and
  its build-and-verify step (`finalize`).
- It **turns off archify's update check.** That check contacts archify's website
  about once a day and saves a small reminder file outside your project. Turning
  it off keeps `show-it-deep` from going online or writing anywhere except
  `.ai/output/visuals/`. To hear about new archify versions, watch its GitHub
  page, or run archify yourself without the skill.
- It **never uses archify's no-shell shortcut**, where the AI hand-edits
  archify's 700 KB page template directly. That would cost a huge number of
  tokens; if commands can't run, the guard stops it first.
- If archify's build check fails and it can't fix the problem within its own
  limit, `show-it-deep` tells you which check failed and gives you a `show-it`
  diagram instead. It never presents a failed diagram as finished.

The result is one HTML file. Open it in any browser; nobody needs archify
installed to view it, so you can send it to anyone.

## When something is missing

| What's missing                              | What happens                                                            |
| :------------------------------------------ | :---------------------------------------------------------------------- |
| archify not installed                       | `show-it-deep` stops at once, explains why, links archify's GitHub page |
| App can't run commands (e.g. a chat window) | `show-it-deep` stops at once and explains why; use `/show-it` there     |
| Node.js missing or older than 18            | `show-it-deep` stops, says so, and links nodejs.org                     |
| No browser for screenshots                  | `show-it` draws a text sketch of the page instead                       |
| Web app chat                                | `show-it` works; `show-it-deep` needs a coding app                      |
