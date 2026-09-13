#!/usr/bin/env bash
# Auto-commit and push source changes after each Claude turn.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

git add -A

if git diff --cached --quiet; then
  exit 0
fi

MSG_FILE=".claude/hooks/.next-commit-message.txt"
if [ -s "$MSG_FILE" ]; then
  COMMIT_MSG="$(cat "$MSG_FILE")"
else
  CHANGED_FILES="$(git diff --cached --name-only | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')"
  COMMIT_MSG="Update: ${CHANGED_FILES}"
fi

if git commit -m "$COMMIT_MSG" >/tmp/claude-auto-commit.log 2>&1; then
  rm -f "$MSG_FILE"

  PUSHED=0
  for i in 1 2 3 4 5; do
    git fetch origin main >/tmp/claude-auto-push.log 2>&1
    if git rebase origin/main >>/tmp/claude-auto-push.log 2>&1 && git push origin HEAD:main >>/tmp/claude-auto-push.log 2>&1; then
      PUSHED=1
      break
    fi
    git rebase --abort >/dev/null 2>&1
    sleep 2
  done

  if [ "$PUSHED" = "1" ]; then
    echo "Auto-committed and pushed to origin/main."
  else
    echo "!!! Auto-committed LOCALLY, but push to origin/main FAILED after retries (likely diverged from a concurrent push, e.g. the gold-price bot) — run 'git rebase origin/main && git push' manually:"
    tail -n 10 /tmp/claude-auto-push.log
  fi
else
  echo "git commit failed:"
  cat /tmp/claude-auto-commit.log
fi

exit 0
