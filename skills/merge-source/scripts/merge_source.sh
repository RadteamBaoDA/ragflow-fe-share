#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  merge_source.sh --source <branch> [options]

Options:
  --source <branch>     Source branch to merge from (required)
  --target <branch>     Target branch to merge into (default: current branch)
  --remote <name>       Remote name (default: origin)
  --strategy <mode>     merge | ff-only | rebase (default: merge)
  --allow-dirty         Allow uncommitted changes in working tree
  --apply               Execute commands (default: dry-run only)
  -h, --help            Show this message

Examples:
  merge_source.sh --source main
  merge_source.sh --source develop --target release/1.2 --strategy ff-only
  merge_source.sh --source main --target feature/x --apply
EOF
}

die() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

run() {
  if [[ "$APPLY" -eq 1 ]]; then
    printf '+ %s\n' "$*"
    "$@"
  else
    printf '+ %s\n' "$*"
  fi
}

SOURCE_BRANCH=""
TARGET_BRANCH=""
REMOTE_NAME="origin"
STRATEGY="merge"
ALLOW_DIRTY=0
APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_BRANCH="${2:-}"
      shift 2
      ;;
    --target)
      TARGET_BRANCH="${2:-}"
      shift 2
      ;;
    --remote)
      REMOTE_NAME="${2:-}"
      shift 2
      ;;
    --strategy)
      STRATEGY="${2:-}"
      shift 2
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      shift
      ;;
    --apply)
      APPLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$SOURCE_BRANCH" ]] || die "--source is required"
[[ "$STRATEGY" =~ ^(merge|ff-only|rebase)$ ]] || die "--strategy must be one of: merge, ff-only, rebase"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a Git repository"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ -z "$TARGET_BRANCH" ]]; then
  TARGET_BRANCH="$CURRENT_BRANCH"
fi

if [[ "$ALLOW_DIRTY" -eq 0 ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    die "Working tree is dirty. Commit/stash changes first or pass --allow-dirty"
  fi
fi

SOURCE_REF="$SOURCE_BRANCH"
if ! git show-ref --verify --quiet "refs/heads/$SOURCE_BRANCH"; then
  SOURCE_REF="$REMOTE_NAME/$SOURCE_BRANCH"
fi

printf 'Merge plan\n'
printf '  remote:   %s\n' "$REMOTE_NAME"
printf '  source:   %s\n' "$SOURCE_REF"
printf '  target:   %s\n' "$TARGET_BRANCH"
printf '  strategy: %s\n' "$STRATEGY"
printf '  mode:     %s\n\n' "$( [[ "$APPLY" -eq 1 ]] && printf 'apply' || printf 'dry-run' )"

run git fetch --prune "$REMOTE_NAME"

if [[ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]]; then
  run git checkout "$TARGET_BRANCH"
fi

run git pull --ff-only "$REMOTE_NAME" "$TARGET_BRANCH"

case "$STRATEGY" in
  merge)
    run git merge "$SOURCE_REF"
    ;;
  ff-only)
    run git merge --ff-only "$SOURCE_REF"
    ;;
  rebase)
    run git rebase "$SOURCE_REF"
    ;;
esac

if [[ "$APPLY" -eq 0 ]]; then
  printf '\nDry run only. Re-run with --apply to execute.\n'
fi
