# Merge Playbook

## Preflight Checklist

Run before merging:

```bash
git status --short
git remote -v
git branch --all --verbose
git fetch --prune origin
```

Use a clean working tree unless there is explicit permission to proceed with dirty state.

## Strategy Selection

Choose strategy based on repo policy:

- `merge`: preserve branch topology and merge commit context.
- `ff-only`: require linear history; fail if fast-forward is impossible.
- `rebase`: replay target commits on top of source branch.

Prefer `ff-only` for strict linear-history repos. Prefer `merge` when preserving branch context matters.

## Conflict Resolution Commands

Inspect conflicts:

```bash
git status --short
git diff --name-only --diff-filter=U
```

After edits:

```bash
git add <resolved-file>
git merge --continue
```

Rebase flow:

```bash
git add <resolved-file>
git rebase --continue
```

Abort flow:

```bash
git merge --abort
git rebase --abort
```

## Post-Merge Validation

Run repository checks immediately after integration:

```bash
# examples; replace with project commands
npm test
npm run lint
```

Then summarize:

- branch integrated (`source -> target`)
- merge/rebase strategy used
- conflict count and files touched
- verification commands and outcomes
