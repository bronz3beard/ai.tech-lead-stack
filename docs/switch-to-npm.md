# Switch Tech-Lead Stack to npm

[← Back to the README](../README.md)

You set up Tech-Lead Stack by downloading its code into a folder and running
`install.sh`. It now installs from npm, and your coding apps always start the
newest version. These steps remove the old setup, then an AI assistant walks you
through a fresh one. If you like, step 6 brings your API keys and usage-metrics
database over from the old folder first.

## Before you start

- Open **Terminal**, and do every step in that same window.
- You need Node.js 22.5 or later. `node -v` shows yours; if it is older, install
  the current version from [nodejs.org](https://nodejs.org) first.
- Know which folder you downloaded Tech-Lead Stack into: the one with
  `install.sh` in it. Not sure? In Claude Code, `claude mcp get tech-lead-stack`
  shows it (use `slm-gate` instead of `tech-lead-stack` if you use slm-gate). It
  is the part in front of `/dist/mcp-server.mjs`, or the part after `--prefix`.
- Decide whether to start clean or keep your old settings (your Anthropic and
  Gemini API keys, and the web app's database address for usage metrics).
  Starting clean? Have them ready to enter again. Keeping them? Step 6 copies
  them over.
- Moving slm-gate to npm as well? Do that first, with
  [its guide](https://github.com/zenithfoundry/slm-gate/blob/main/docs/install-from-npm.md#switching-from-a-git-checkout),
  then come back here.

## 1. Quit your coding apps

Quit every app that uses Tech-Lead Stack: Claude Code, Claude Desktop, Cursor,
VS Code (for Continue or Cline), Gemini CLI, Antigravity and any others.

## 2. Tell Terminal where your old folder is

Change the path to your folder, then run both lines.

```bash
OLD=~/tech-lead-stack
ls "$OLD/install.sh"
```

The second line should print the path back. If it says "No such file or
directory", the path is wrong: fix it and run both lines again.

## 3. Check the new version is out

```bash
npx -y tech-lead-stack@1 help
```

The list should include `init` and `uninstall`. If it doesn't, the new version
isn't released yet: stop here and keep using your current setup.

## 4. Unlink each project that uses it

This lists every project linked to the old folder:

```bash
find ~ -maxdepth 5 -type l -name .agents -lname "$OLD*" 2>/dev/null
```

Each line ends in `/.agents`; the part in front of it is a project. For each
one, go into it and unlink it (change the path to the project):

```bash
cd ~/code/my-app
bash "$OLD/scripts/cleanup.sh"
```

This removes the links to the old folder (`.ai`, `.agents`, `AGENTS.md`). Your
own files are not touched. It also removes the pull request template the old
installer copied into `.github`, if you never changed it; to keep it, run
`git checkout .github/PULL_REQUEST_TEMPLATE.md` afterwards.

## 5. Remove the old setup from your apps

Stay in the last project folder from step 4; this won't run from your home
folder. First see what it will remove:

```bash
bash "$OLD/scripts/cleanup.sh" --global
```

Then remove it:

```bash
bash "$OLD/scripts/cleanup.sh" --global --apply
```

This removes the old connections from each app, the old `/tls:` commands in
Claude Code, the old Cursor skills and Continue prompts, and the `rtk` shortcut
the old installer added to your shell. A gateway such as slm-gate stays: only
its link to the old folder is removed. Each file it edits is backed up next to
itself as `.bak` first.

## 6. Optional: bring your old settings over

Skip this step for a clean start. To keep your API keys and your usage-metrics
database, copy your old settings file to where the new version reads it:

```bash
mkdir -p ~/.tech-lead-stack
cp -pn "$OLD/.env" ~/.tech-lead-stack/.env
chmod 600 ~/.tech-lead-stack/.env
```

This copies only. It never replaces a file that is already there, and nothing in
the old folder changes. Your usage history stays where it always was, in that
database, so the web app's dashboard shows old and new together. Settings only
the web app uses come along too; your coding apps ignore them.

Then fix settings that still point to the old folder:

```bash
grep -n "$OLD" ~/.tech-lead-stack/.env
```

Nothing printed? Go to step 7. Otherwise open the settings file (on Linux or
WSL, use `nano` instead of `open -e`):

```bash
open -e ~/.tech-lead-stack/.env
```

Delete each line that was printed. The usual ones start with
`TECH_LEAD_STACK_ROOT=` or `REPO_ROOT=`: left in, they would make the new
version read its skills from the old folder. Save the file, then run the `grep`
line again: it should print nothing now.

## 7. Set it up fresh with the AI setup prompt

Open your AI coding assistant (Claude Code, Cursor, Gemini or any other) in one
of your projects. Copy the prompt from
[Set this up with an AI assistant](agent-setup.md) and paste it in.

The assistant checks your computer, asks what you want help with, and runs the
fresh install for you:

- it connects each of your apps, behind slm-gate if you use it;
- it installs the `/tls:` commands, Cursor skills, Continue prompts, the
  project's workflow files and RTK;
- it tells you where to add your API keys and database address, so they never
  pass through the chat.

If something is missing, such as Node.js, it stops and tells you how to get it.
Tell it when you're ready and it carries on. It finishes by checking the whole
setup and giving you a short "start here" summary. If you brought your settings
over in step 6, it sees your keys are already set and won't ask for them.

No assistant to hand? Run the same fresh install yourself, in a project folder:
`npx -y tech-lead-stack@1 init`. It lists every change, asks once, then offers
to take your keys.

## 8. Add the workflow files to your other projects

Your apps are done, so in each other project from step 4 this only adds the
workflow files:

```bash
cd ~/code/another-app
npx -y tech-lead-stack@1 init --yes
```

## 9. Check everything

Open a **new** Terminal window, so the old `rtk` shortcut is gone, then run:

```bash
npx -y tech-lead-stack@1 doctor
```

The last line should say **Everything needed is in place**. If not, each line
marked ! or ✗ has a line under it starting with → that says what to do. Lines
marked · are optional extras. Then restart your coding apps: in Claude Code,
type `/tls:` to see the commands.

## 10. Decide what to do with the old folder

Only when everything above works:

- **You run the web app from it:** keep it. The web app still runs from that
  folder ([how](web-app.md#run-it-on-your-own-machine)).
- **You don't:** drag it to the Trash. Settings you brought over in step 6 are
  safe: they now live in `~/.tech-lead-stack`.

If anything stops working, drag it back out and
[tell us what happened](https://github.com/bronz3beard/ai.tech-lead-stack/issues).

> **From now on,** there is nothing to update by hand: your apps start the
> newest 1.x version each time. When `doctor` says your commands and skills are
> from an older version, refresh them with `npx -y tech-lead-stack@1 init`. Any
> you edited are left alone.

To remove it all later: `npx -y tech-lead-stack@1 uninstall` shows what it would
remove, and `--apply` removes it. Your settings file and RTK are kept.
