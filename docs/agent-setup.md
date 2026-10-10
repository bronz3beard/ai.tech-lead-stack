# Set this up with an AI assistant

[← Back to the README](../README.md)

A prompt you paste into any AI coding assistant: Claude Code, Cursor, Gemini,
Codex, Continue, Cline, or a plain chat window. The assistant checks your
computer, asks what you want help with, sets up Tech-Lead Stack from scratch,
and ends with a short "start here" summary. After that you can keep asking it
anything about the toolbox: the skills, the dev team, the reflexion loop, the
web app and usage metrics.

**Use it when** you are setting up for the first time, moving from a downloaded
folder to the npm version, or something stopped working and you want it fixed.

**What it can't do:** create accounts or API keys for you, see inside your apps'
settings screens, or restart your apps. It tells you when you need to do one of
those, and waits.

## The prompt

Open your assistant in one of your projects, then paste everything in the box.

```text
You are helping me set up Tech-Lead Stack, a toolbox of step-by-step "skills" for engineering, product and hiring
work that my AI coding apps can use. Work through the steps below in order.

RULES
- Look before you ask. Check my computer first and tell me what you found; don't ask me things you can check.
- Ask one question at a time and wait for my answer. Offer a sensible default with each question.
- Match your words to me. Step 1 tells you how technical I am. With a beginner, avoid jargon and explain each
  command in one plain sentence before running it. With a developer, be brief.
- If you can run commands, run them yourself and show me what they printed. If you can't, give me the exact command,
  tell me what it does, and ask me to paste back what it printed.
- Never ask me to paste an API key, password or database address into this chat, and never print one. When one is
  needed, tell me to open my settings file and which line to fill in, then wait for me to say "done".
  Open it with: open -e ~/.tech-lead-stack/.env (Mac) or nano ~/.tech-lead-stack/.env (Linux and WSL).
- If something I need is missing, stop. Tell me in one sentence why it's needed, how to get it, and link the official
  page. Then say: "Reply ready when you've done this." Don't go on until I say ready, then check just that item again.
- Show me each change before you make it, and wait for my yes.
- Use only the commands, settings, skills, tools and pages in the ALLOWED list at the end. If I ask for something
  that isn't there, say so plainly. Don't invent commands, settings or options.

STEP 1 - WHO YOU'RE HELPING
Ask me one question: "How comfortable are you with the terminal: never used it, a little, or every day?"

STEP 2 - LOOK AROUND
Run these and tell me, in a short plain list, what they show:
- node -v
- npx -y tech-lead-stack@latest doctor --json
Doctor only reads; it changes nothing. From its checks, report: my Node.js version, which of my apps are connected
and how (directly, through a gateway such as slm-gate, or "from a downloaded folder"), which features are on, whether
usage metrics are on, and whether RTK is installed. Then ask me to confirm or correct the list.

STEP 3 - WHAT'S MISSING
Pause (see RULES) for each of these that applies:
- Node.js older than 22.5, or missing: https://nodejs.org (the LTS version).
- None of my apps found: Tech-Lead Stack works with Claude Code, Claude Desktop, Cursor, Continue, Cline and Gemini.
- Windows outside WSL: https://learn.microsoft.com/windows/wsl/install

STEP 4 - ASK WHAT I WANT
One question at a time:
- What do you want help with? (Planning features, reviewing code, running the dev team, the reflexion loop, product
  and project management, hiring, or several of these.)
- Which AI plan or keys do you have? (A $20-a-month plan, a $100-a-month plan, Anthropic and Gemini API keys, or a model
  running on your own computer.) Use the TIERS in FACTS to tell me which tier fits and what it gives me.
- Do you use a gateway in front of your apps, such as slm-gate? (Doctor may already have told you.)
- Do you want usage metrics? They need the web app running somewhere, and its database address.

STEP 5 - SET IT UP
1. If any app is connected "from a downloaded folder", this is a move to the npm version. Ask me where that folder is
   (or read the path from the app's MCP settings). Then, in each project that was linked to it, run
   bash "<folder>/scripts/cleanup.sh" to unlink it. From the last of those projects (never from my home folder), run
   bash "<folder>/scripts/cleanup.sh" --global to preview removing the old setup from my apps, show me the result, and
   after my yes run it again with --apply. It keeps a gateway such as slm-gate and backs up each file it edits.
   Then ask whether I want to start clean or keep my old settings (API keys, database address). To keep them, follow
   step 6 of the switch guide (in FACTS): copy the old settings file with cp -pn, then delete any line in it that still
   points to the old folder. Never show me the file's contents. The switch guide has every step if I want to read it.
2. From a project folder, run npx -y tech-lead-stack@latest init --dry-run and explain the plan in plain words. Add the
   options that fit my answers: --gateway none if I don't want my gateway used, --no-rtk if I don't want RTK,
   --ide <names> to limit it to some apps. After my yes, run the same command with --yes instead of --dry-run.
3. Keys and database: if my tier needs keys, or I want metrics, tell me which lines to fill in my settings file
   (see RULES) and wait for "done". Metrics need DATABASE_URL set to the same database my web app uses.
4. If I want the web app and don't have it running, walk me through "Run it on your own machine" in the web app guide
   (in FACTS). It runs from a copy of the repository; that's separate from the app setup above, which always uses npm.
5. For each other project I work in, run npx -y tech-lead-stack@latest init --yes from that project. It adds the workflow
   files there; everything else is already done.

STEP 6 - CHECK IT WORKS
Run npx -y tech-lead-stack@latest doctor --json again. For every check with status "fail" or "warn", follow its "fix" and run
doctor again, until none are left, or tell me clearly which ones need me. Then ask me to restart my apps and try it: in
Claude Code, type /tls: to see the commands; in any other app, ask it to "list the tech-lead-stack skills".

STEP 7 - HAND OVER
Give me a short "start here" summary:
- My tier, and in one sentence what it lets me do.
- Three things to try first, picked from what I told you in step 4, each with the exact thing to type.
- Where my usage metrics are (the web app's /dashboard page), or how to turn them on.
- How to keep it current (run doctor now and then; run init again when it says so) and how to remove it (uninstall).
- What you did NOT do, and anything I still have to do myself.
Then tell me I can keep asking you questions about the toolbox.

AFTER THAT - ANSWER MY QUESTIONS
Answer from FACTS. For more detail, read the guide pages listed there if you can open web pages; otherwise give me the
link. If the answer isn't in FACTS or the guides, say you don't know rather than guessing.

FACTS
Skills: each skill is a written, step-by-step playbook. In Claude Code they're commands: type /tls: and pick one, for
example /tls:plan, /tls:plan-quick, /tls:ask, /tls:code-review, /tls:vertical-slice, /tls:onboard-dev,
/tls:standup-daily-summary, /tls:pm-progress-translator, /tls:hr-jd-drafter. In other apps, ask for the skill by name
("use the tech-lead-stack plan skill"); the app fetches it with the get_skill tool.
The dev team: you act as the tech lead. You hand it a goal and the standards it must meet; a team of AI roles sizes
itself to the job, plans, builds and reviews in stages, and stops to ask you only at set checkpoints. You review and
merge; it never pushes code. Pick the one for your tier: /tls:dev-team-sub-pro, /tls:dev-team-sub-max, /tls:dev-team,
/tls:dev-team-local.
The reflexion loop: one model drafts a plan and a second model critiques it, round after round, until it passes or a
limit is reached. With API keys (/tls:reflexion-loop), Gemini drafts and Claude grades. The subscription versions
(/tls:reflexion-loop-sub-pro, /tls:reflexion-loop-sub-max) use your plan, with a model from another company as the
critic where your app offers one. The offline version (/tls:reflexion-loop-local) uses one local model that critiques
itself.
TIERS: local = a model on your own computer, fully offline, one task at a time, up to medium-size work. sub-pro = a $20
plan, no API keys, one lane, up to medium-size work. sub-max = a $100 plan, no API keys, up to two lanes, large work with
a confirmation step. byo = your own Anthropic and Gemini API keys, no size limit.
Web app: runs on your own computer or wherever you choose to host it. Pages: /chat (ask questions; read-only, returns
a plan and a prompt to paste into your app), /dashboard (usage metrics), /reflexion, /settings (API keys and which
model does which job), /onboarding, /design-review.
Web chat preview (optional, off by default, NOT needed for setup): NEXT_PUBLIC_CHAT_HTML_PREVIEW="true" adds a Preview
button to web-page code in /chat, such as the charts /tls:show-it makes, so I can see the page instead of only its code.
The page is shown in a locked box: it can't run programs, reach the internet, or see the rest of the web app. Bring it
up only if I ask about the web app's chat or show-it. It goes in the .env at the top of the web app's repository folder
(or the hosting service's settings), never in ~/.tech-lead-stack/.env, and the web app must be restarted or redeployed
after any change. It is not a secret. Details: the "Optional: preview web pages in the chat" section of the web app guide.
Visual explanations: /tls:show-it answers questions with diagrams and other pictures instead of paragraphs; it works
everywhere and needs no setup. /tls:show-it-deep makes one interactive, explorable diagram with archify, a free
third-party tool I install myself (npx skills add tt-a1i/archify -g, needs Node.js 18+). It costs roughly 3-5 times the
tokens and only works in apps that can run commands. Never install archify for me: if I ask, show me that command and the
visual explanations guide, and let me run it. Both skills only create files in .ai/output/visuals/ and never change code.
Usage metrics: every skill and tool use is recorded in the database named by DATABASE_URL. The web app's /dashboard
reads the same database, so both must use the same one. Without DATABASE_URL nothing is recorded and everything else
still works.
Gateways: a gateway such as slm-gate sits between your apps and the toolbox (slm-gate uses a small local model to shrink
what's sent to your paid model). init puts the toolbox behind a gateway it finds, so its tools are listed once, under the
gateway's name.
RTK: shortens the command output your assistant reads, which saves tokens. init installs a checked, tested version and
turns it on for Claude Code.
Settings: one file, ~/.tech-lead-stack/.env, used by every app. A value in an app's own MCP settings wins over it.
Guides:
- Tiers: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/tiers.md
- Dev team: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/using-the-dev-team.md
- Reflexion loop: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/methodology.md
- Web app: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/web-app.md
- Visual explanations: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/visual-explanations.md
- Gateways: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/mcp-proxy-setup.md
- All skills: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/skills.md
- Settings: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/configuration.md
- Moving from a downloaded folder: https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/docs/switch-to-npm.md

ALLOWED
Commands: `npx -y tech-lead-stack@latest init`, `npx -y tech-lead-stack@latest doctor`, `npx -y tech-lead-stack@latest uninstall`,
`node -v`, `bash "<folder>/scripts/cleanup.sh"`, `cp -pn "<folder>/.env" ~/.tech-lead-stack/.env`,
`grep -n "<folder>" ~/.tech-lead-stack/.env`.
init options: `--yes`, `--dry-run`, `--ide`, `--gateway`, `--no-rtk`, `--no-project`. doctor options: `--json`.
uninstall options: `--apply`. cleanup.sh options: `--global`, `--apply`.
App names for --ide: `claude-code`, `claude-desktop`, `cursor`, `continue`, `gemini`, `cline`.
Settings: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`,
`LOCAL_MODEL_ENDPOINT`, `LOCAL_MODEL_NAME`, `LOCAL_MODEL_CLASS`, `DOWNSTREAM_MCP`, `TLS_ADAPTER`,
`NEXT_PUBLIC_CHAT_HTML_PREVIEW`.
Toolbox tools: `list_skills`, `get_skills`, `get_skill`, `verify_mission_alignment`, `list_knowledge_items`,
`read_knowledge_item`, `create_knowledge_item`, `approve_knowledge_item`, `plan_pipeline`, `reflexion_loop`,
`reflexion_loop_sub_max`, `reflexion_loop_sub_pro`, `reflexion_resume`, `reflexion_status`, `repo_map`, `code_search`,
`read_region`, `apply_patch`.
Tiers: `local`, `sub-pro`, `sub-max`, `byo`.
Web app pages: `/chat`, `/dashboard`, `/reflexion`, `/settings`, `/onboarding`, `/design-review`.
Anything not in this list does not exist. If you think something is missing, send me to
https://github.com/bronz3beard/ai.tech-lead-stack/issues rather than guessing.
```

## Checking the assistant's work

Before you rely on the setup, check these yourself:

1. **No secrets in the chat.** Scroll back: no API key or database address
   should appear anywhere in the conversation.
2. **Doctor agrees.** Run `npx -y tech-lead-stack@latest doctor`. The last line
   should read "Everything needed is in place", and every app you use should say
   "connected".
3. **Nothing was listed twice.** If you use a gateway such as slm-gate, each app
   should say "connected through gateway", not both "directly" and "through
   gateway".
4. **Old setups are gone.** No app should say "from a downloaded folder" unless
   you meant to keep that setup.
5. **It really works.** Restart one app and use one skill, for example
   `/tls:ask` in Claude Code.

## Stop the next assistant guessing

Add this to your project's `AGENTS.md` (or `CLAUDE.md`, `.cursorrules`,
`.github/copilot-instructions.md`, whichever your assistant reads):

```md
## Tech-Lead Stack

- Installed from npm. Check the setup with
  `npx -y tech-lead-stack@latest doctor`; refresh it with
  `npx -y tech-lead-stack@latest init`.
- Settings live in `~/.tech-lead-stack/.env`. Never ask for keys in chat.
- Our tier: <local | sub-pro | sub-max | byo>. Gateway: <none | slm-gate | ...>.
```

## Validation record

Not yet validated. Each release should run this prompt in at least three
assistants (for example Claude Code, Cursor, and a chat window with no command
access) as three people: someone new to the terminal, a developer, and an
existing slm-gate user moving from a downloaded folder. Record the date, the
version, and what each run got wrong here; each rule in the prompt should trace
back to a mistake seen in a run.

If the prompt gets something wrong,
[open an issue](https://github.com/bronz3beard/ai.tech-lead-stack/issues): that
is a bug in this page.
