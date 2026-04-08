# Branch Management Strategy

This project uses **Trunk Based Development** (TBD) as its core branch management strategy. Trunk Based Development is a source-control branching model where developers collaborate on code in a single branch called `main` (or `trunk`), and resist any pressure to create long-lived development branches.

## Core Strategy

- **Single Source of Truth:** `main` is the primary branch. All work is integrated into `main` frequently.
- **Short-Lived Branches:** Feature branches should be short-lived (e.g., lasting no more than a couple of days). They should contain small, incremental changes.
- **Rebase Strategy:** We use `git rebase` to keep the commit history linear and clean. Always rebase your feature branch on top of the latest `main` before opening a Pull Request.
- **Squash and Merge:** When merging a Pull Request into `main`, we use the **Squash and Merge** strategy. This ensures that all commits from a feature branch are combined into a single, cohesive commit on the `main` branch, keeping the history readable and easy to revert if necessary.

---

## Day-to-Day Workflow

### 1. Create a New Branch
Always create a new branch from the latest `main`:
```bash
# Ensure you are on main and up to date
git checkout main
git pull origin main

# Create and checkout a new branch
git checkout -b feature/my-awesome-feature
```

### 2. Make Changes and Commit
Make your changes, and commit them logically. You can make multiple commits while working locally:
```bash
git add .
git commit -m "feat: implement initial logic for awesome feature"

# ... more changes ...
git commit -m "fix: resolve edge cases in awesome feature"
```

### 3. Keep Your Branch Up to Date (Rebase)
As you work, `main` might receive new updates. To keep your branch up to date and avoid merge conflicts later, rebase your branch against `main`:
```bash
# Fetch latest from remote
git fetch origin

# Rebase your current branch onto main
git rebase origin/main
```
*If there are conflicts, Git will pause the rebase. Resolve the conflicts in your editor, `git add` the resolved files, and run `git rebase --continue`.*

### 4. Push and Open a Pull Request
Once your work is ready and rebased, push your branch to the remote repository. Since we rebase, you might need to force push if you have rewritten history:
```bash
# Using --force-with-lease is safer than --force because it prevents you from accidentally
# overwriting someone else's commits if they have pushed to the same branch in the meantime.
# For more information, read: https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-lease
git push origin feature/my-awesome-feature --force-with-lease
```
Open a Pull Request (PR) against `main`.

### 5. Review and Merge (Squash and Merge)
- Address any feedback from code reviews.
- Once the PR is approved and all CI checks pass, it will be merged into `main`.
- **Merge Strategy:** The PR must be merged using **Squash and Merge**. This will take all commits from `feature/my-awesome-feature` and squash them into a single commit on `main`.

---

## Example: Updating a Stale PR

If your PR has been open for a while and `main` has moved forward, you need to update it using rebase:

```bash
git checkout feature/my-awesome-feature
git fetch origin
git rebase origin/main
# Resolve any conflicts...
git push origin feature/my-awesome-feature --force-with-lease
```

---

## Resources for Devs and AI

For more information on Trunk Based Development and related best practices, please refer to the following resources:

- [Trunk Based Development (Official Site)](https://trunkbaseddevelopment.com/)
- [MinimumCD - Branching Strategy](https://beyond.minimumcd.org/docs/team-chatbot/)
- [Atlassian: Trunk-based development](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development)
- [GitHub Flow (A similar model)](https://docs.github.com/en/get-started/using-github/github-flow)

### Guidelines for AI Agents
- When generating bash scripts for git operations, always prefer `git pull --rebase` and `git rebase main`.
- When creating PRs, ensure the intent is to use squash merging.
- Do not suggest or create long-lived release branches unless explicitly instructed to deviate from the standard TBD strategy.
