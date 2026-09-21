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

# Repo layout — products live in products/

All product pages moved out of the repo root into `products/` — every product has its own kebab-case folder, even single-file products with no separate CSS/JS (e.g. `products/mini-game-hub/html/index.html`). Inside each product folder, files are split into a subfolder per file type: `html/`, `css/`, `js/` (`.ts` sits next to its compiled `.js`) — only the ones that actually exist for that product — plus `data/` (bot-generated JSON), `json/` (hand-written seed JSON), or `py/` (CI-only Python scripts) when applicable. A page that supports one product but isn't a product of its own (e.g. VietLong Creator's privacy/terms pages) lives inside that product's own `html/`, not as a sibling in `products/`. See the `project-structure` skill for the full naming/structure rule this follows. Root now holds only `index.html` plus `CLAUDE.md`, the one file a platform constraint forces to stay there.

GoldTrack is **not** a single self-contained file — its styles and logic live outside the HTML:

- [products/gold-track/html/index.html](products/gold-track/html/index.html) — markup only (~320 lines)
- [products/gold-track/css/gold-track.css](products/gold-track/css/gold-track.css) — all styles
- [products/gold-track/js/gold-track.js](products/gold-track/js/gold-track.js) — all logic (one IIFE, loaded at end of `<body>`)
- [products/gold-track/sw-gold-track.js](products/gold-track/sw-gold-track.js) — service worker **entry point only**, one real line, living directly in `products/gold-track/` (a sibling of `html/`, `css/`, `js/`, `data/`, `img/` — not nested inside any of them). A service worker's default scope is the directory containing the script that registers it, plus everything below it. Nested in `js/` the scope would shrink to `/products/gold-track/js/` and no longer cover `html/`, `data/`, `img/` — breaking GoldTrack's own offline support. Placed directly in `products/gold-track/`, the scope is exactly `/products/gold-track/`, which is exactly what this service worker needs (it has never controlled anything outside GoldTrack — `GOLDTRACK_PATHS` already guards every request regardless of scope). (Widening scope beyond the script's own directory needs the `Service-Worker-Allowed` header, which GitHub Pages cannot set — verified: forcing a wider scope throws `SecurityError`.) So this folder keeps only the shell; it `importScripts` the real logic. This used to live at the repo root "for future-proofing," but that gave it origin-wide scope it never needed — moved in per the one-folder-per-product rule once that stopped making sense.
- [products/gold-track/js/sw-core.js](products/gold-track/js/sw-core.js) — the actual service worker logic, living next to the rest of GoldTrack's code. Never registered directly.
- [products/gold-track/manifest.json](products/gold-track/manifest.json) — Web App Manifest, linked from `index.html`'s `<head>`. Note: this does **not** make iOS "Add to Home Screen" icons self-heal after a future URL move — iOS bookmarks the literal URL it was added from, it doesn't consult `start_url` for that. It's still worth having for other installability benefits (Android/desktop "install app", standalone display, theme color).

GoldTrack fetches its own data with root-absolute paths (`/products/gold-track/data/*.json`). Its `navigator.serviceWorker.register()` call is absolute too (`/products/gold-track/sw-gold-track.js`) — that one isn't optional: the shell lives directly in `products/gold-track/` while `index.html` sits one directory deeper at `products/gold-track/html/`, and a relative path in `register()` resolves against the *document's* URL, not the script's own location — a bare filename would incorrectly resolve to `products/gold-track/html/sw-gold-track.js` (404, and `register()`'s `.catch()` would swallow the failure silently). Since a returning visitor's browser may still have the old root-scoped (`scope: "/"`) registration active from before this moved, the registration code also unregisters any service worker whose scope is exactly the origin root — otherwise that stale registration would just sit there doing nothing useful forever.

**When adding a file GoldTrack loads at runtime**, add its path to `products/gold-track/js/sw-core.js` as well (`APP_CODE_PATHS` for code that changes often, `ICON_PATHS` for immutable assets, `DATA_PATHS` for JSON) and bump `CACHE_NAME` — otherwise the app breaks offline, or keeps serving a stale copy. Bump the `?v=` in the shell's `importScripts` to the same number, so the imported script is re-fetched regardless of engine differences in how imports are update-checked.

ThubeeFarmery and worldcup-2026 follow the same one-folder-per-product pattern (`products/thubee-farmery/`, `products/worldcup-2026/`) — same reasoning applies if either grows a service worker later. ThubeeFarmery also has its own `products/thubee-farmery/manifest.json` (same iOS caveat as above); worldcup-2026 generates its manifest dynamically in JS instead (see `setupPWA()` in `products/worldcup-2026/js/worldcup-2026.js`).

This file (`CLAUDE.md`) must stay at the repo root so Claude Code auto-loads it. [README.md](README.md) also stays at root — GitHub only renders a repo's root `README.md` as its homepage on github.com, not one from a subfolder. `robots.txt` and `sitemap.xml` are the other two root exceptions: the Robots Exclusion Protocol requires `robots.txt` at the exact domain root to be found by crawlers, and `sitemap.xml` follows the same near-universal convention search engines expect by default. These four are the only root exceptions. Each product also has its own `docs/*.md` describing that product specifically (see `products/<name>/docs/`).

# GoldTrack changelog

`products/gold-track/html/index.html` shows a version badge (top header, all tabs) that opens an in-app "Lịch sử cập nhật" popup reading from [products/gold-track/data/changelog.json](products/gold-track/data/changelog.json). This is a **user-facing** changelog, not raw commit messages — write entries in plain Vietnamese describing what changed for the user, not implementation detail.

**Whenever you make a user-visible change to GoldTrack** (any of `products/gold-track/html/index.html`, `products/gold-track/css/gold-track.css`, `products/gold-track/js/gold-track.js`, or the Python fetchers that feed it — new feature, fixed bug, redesign, but not internal refactors/comments), bump the version (increment the last segment, e.g. `1.10` → `1.11`) and prepend a new entry to `products/gold-track/data/changelog.json`'s `entries` array with that version, today's date, and 1-3 short bullet points. Update the top-level `"version"` field to match. The header badge and popup read this file directly — no code change needed elsewhere.
