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
  if git push origin main >/tmp/claude-auto-push.log 2>&1; then
    echo "Auto-committed and pushed to origin/main."
  else
    echo "Auto-committed locally, but push to origin/main FAILED:"
    tail -n 5 /tmp/claude-auto-push.log
  fi
else
  echo "git commit failed:"
  cat /tmp/claude-auto-commit.log
fi

exit 0
