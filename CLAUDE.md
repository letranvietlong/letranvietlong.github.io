# Auto-commit workflow

This repo has a Stop hook ([.claude/hooks/auto-commit-push.sh](.claude/hooks/auto-commit-push.sh)) that automatically commits and pushes to `origin/main` after every turn that changes files.

**Before ending any turn where you edited or created source files**, write a concise, descriptive commit message summarizing what actually changed (not generic text like "update code") to `.claude/hooks/.next-commit-message.txt`. Example: `Fix mobile nav overlapping logo on Safari`. Keep it to one short line unless the change genuinely has multiple unrelated parts, in which case use a short subject line plus bullet points.

The hook reads this file, uses it as the commit message, and deletes it after a successful commit. If the file is missing or empty, the hook falls back to a generic message listing changed file names — so writing this file is what keeps commit history searchable later.

# GoldTrack changelog

GoldTrack.html shows a version badge (top header, all tabs) that opens an in-app "Lịch sử cập nhật" popup reading from [data/changelog.json](data/changelog.json). This is a **user-facing** changelog, not raw commit messages — write entries in plain Vietnamese describing what changed for the user, not implementation detail.

**Whenever you make a user-visible change to GoldTrack.html** (new feature, fixed bug, redesign — not internal refactors/comments), bump the version (increment the last segment, e.g. `1.10` → `1.11`) and prepend a new entry to `data/changelog.json`'s `entries` array with that version, today's date, and 1-3 short bullet points. Update the top-level `"version"` field to match. The header badge and popup read this file directly — no code change needed elsewhere.
