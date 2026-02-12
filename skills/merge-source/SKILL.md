---
name: merge-source
description: Safely merge a Git source branch into a target branch with preflight checks, explicit strategy selection, and conflict-resolution workflow. Use when requests involve merging upstream changes (for example main into feature), syncing long-lived branches, integrating feature branches, handling merge conflicts, or preparing a clean post-merge validation checklist.
---

# Merge Source

## Overview

Merge branches safely and predictably, starting from repository checks and ending with validation. Prefer a dry-run plan first, then execute once branch names and merge strategy are confirmed.

## Intake

Collect these inputs before running merge commands:

- `source_branch` to merge from (required)
- `target_branch` to merge into (default: current branch)
- `remote` (default: `origin`)
- strategy: `merge`, `--ff-only`, or `rebase`
- execution mode: dry run vs apply

If user input is incomplete, inspect `git status`, current branch, and configured remotes, then propose safe defaults.

## Standard Workflow

1. Verify preconditions.
- Ensure inside a Git repository.
- Ensure working tree is clean unless user explicitly allows dirty state.
- Fetch latest refs from remote.

2. Align target branch.
- Checkout target branch if needed.
- Update target from remote using `git pull --ff-only`.

3. Integrate source branch.
- Resolve source ref (`source` or `remote/source`) explicitly.
- Use the requested strategy.
- Stop at first conflict and switch to conflict-resolution flow.

4. Validate result.
- Run project checks (`test`, `lint`, or targeted validation commands).
- Summarize commit delta and files changed.
- Ask whether to push branch and open follow-up PR/task.

## Scripted Flow

Use `scripts/merge_source.sh` to execute the standard flow consistently.

- Default mode is dry run.
- Pass `--apply` to execute commands.
- Use `--source` always.
- Use `--target` when merge target is not current branch.

## Conflict Resolution

When conflicts happen:

1. List conflicted files via `git status --short`.
2. Resolve files one by one; keep semantic intent from both branches.
3. Stage resolved files with `git add`.
4. Complete with `git merge --continue` or `git rebase --continue`.
5. Abort only when requested: `git merge --abort` or `git rebase --abort`.

For command-level details and recovery commands, read `references/merge-playbook.md`.

## Output Style

Always report:

- selected source and target branches
- selected strategy
- commands run (or planned commands in dry run)
- conflict status
- final verification status
