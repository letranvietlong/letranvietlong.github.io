#!/usr/bin/env bash
# Auto-commit and push source changes after each Claude turn.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

git add -A

if git diff --cached --quiet; then
  exit 0
fi

if git commit -m "Update sourcecode" >/tmp/claude-auto-commit.log 2>&1; then
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
