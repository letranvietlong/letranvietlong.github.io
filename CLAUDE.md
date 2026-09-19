# Auto-commit workflow

This repo has a Stop hook ([.claude/hooks/auto-commit-push.sh](.claude/hooks/auto-commit-push.sh)) that automatically commits and pushes to `origin/main` after every turn that changes files.

**Before ending any turn where you edited or created source files**, write a concise, descriptive commit message summarizing what actually changed (not generic text like "update code") to `.claude/hooks/.next-commit-message.txt`. Example: `Fix mobile nav overlapping logo on Safari`. Keep it to one short line unless the change genuinely has multiple unrelated parts, in which case use a short subject line plus bullet points.

The hook reads this file, uses it as the commit message, and deletes it after a successful commit. If the file is missing or empty, the hook falls back to a generic message listing changed file names — so writing this file is what keeps commit history searchable later.

# Agents & workflow

This project defines four subagents in [.claude/agents/](.claude/agents/):

| Agent | Role | Writes code? |
|---|---|---|
| `planner` | Surveys real code, returns a plan with file:line, risks, and how to verify | No |
| `coder` | Implements the plan, handles the easy-to-forget follow-ups (SW cache list, changelog, commit message) | Yes |
| `tester` | Runs the app in a real browser via Playwright, reports PASS/FAIL with actual numbers | Test scripts only |
| `reviewer` | Reviews the diff against the bug classes this repo has actually hit | No |

Run all four in sequence with `/workflow <yêu cầu>` ([.claude/commands/workflow.md](.claude/commands/workflow.md)).

**Judgement on when to use it:** the pipeline is for substantial work — new features, bugs with an unknown cause, refactors, anything touching portfolio math or sync. For a one-line change (text, colour, typo), skip it and just make the change; spinning up four agents for that is pure waste. Say so plainly rather than running the pipeline out of ceremony.

**When orchestrating:** each agent starts cold and sees neither this conversation nor the previous agent's output, so every prompt must be self-contained (paste the actual plan/findings, not "làm theo kế hoạch"). Verify what agents claim — check `git diff` yourself rather than trusting "đã sửa xong".

Note: agent definitions are loaded when a session starts, so a newly added or renamed agent only becomes available after restarting Claude Code. Skills are picked up immediately.

# GoldTrack file layout

GoldTrack is **not** a single self-contained file — its styles and logic live outside the HTML, matching the convention the other large pages here use:

- [GoldTrack.html](GoldTrack.html) — markup only (~320 lines)
- [css/goldtrack.css](css/goldtrack.css) — all styles
- [js/goldtrack.js](js/goldtrack.js) — all logic (one IIFE, loaded at end of `<body>`)
- [sw-goldtrack.js](sw-goldtrack.js) — service worker, **must stay at the repo root**: a service worker can only control pages at or below its own directory, so moving it into `js/` would shrink its scope to `/js/` and silently kill offline support for `/GoldTrack.html`. Widening it needs the `Service-Worker-Allowed` header, which GitHub Pages cannot set.

**When adding a file GoldTrack loads at runtime**, add its path to `sw-goldtrack.js` as well (`APP_CODE_PATHS` for code that changes often, `ICON_PATHS` for immutable assets, `DATA_PATHS` for JSON) and bump `CACHE_NAME` — otherwise the app breaks offline, or keeps serving a stale copy.

This file (`CLAUDE.md`) must also stay at the repo root so Claude Code auto-loads it; other docs live in [docs/](docs/).

# GoldTrack changelog

GoldTrack.html shows a version badge (top header, all tabs) that opens an in-app "Lịch sử cập nhật" popup reading from [data/changelog.json](data/changelog.json). This is a **user-facing** changelog, not raw commit messages — write entries in plain Vietnamese describing what changed for the user, not implementation detail.

**Whenever you make a user-visible change to GoldTrack** (any of `GoldTrack.html`, `css/goldtrack.css`, `js/goldtrack.js`, or the Python fetchers that feed it — new feature, fixed bug, redesign, but not internal refactors/comments), bump the version (increment the last segment, e.g. `1.10` → `1.11`) and prepend a new entry to `data/changelog.json`'s `entries` array with that version, today's date, and 1-3 short bullet points. Update the top-level `"version"` field to match. The header badge and popup read this file directly — no code change needed elsewhere.
