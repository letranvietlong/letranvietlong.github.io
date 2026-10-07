# Auto-commit workflow

This repo has a Stop hook ([.claude/hooks/auto-commit-push.sh](.claude/hooks/auto-commit-push.sh)) that automatically commits and pushes to `origin/main` after every turn that changes files.

**Before ending any turn where you edited or created source files**, write a concise, descriptive commit message summarizing what actually changed (not generic text like "update code") to `.claude/hooks/.next-commit-message.txt`. Example: `Fix mobile nav overlapping logo on Safari`. Keep it to one short line unless the change genuinely has multiple unrelated parts, in which case use a short subject line plus bullet points.

The hook reads this file, uses it as the commit message, and deletes it after a successful commit. If the file is missing or empty, the hook falls back to a generic message listing changed file names — so writing this file is what keeps commit history searchable later.

**Several Claude sessions may work on this repo at the same time** (it has happened: one session on GoldTrack while another built FuelTrack). The hook does `git add -A`, so whichever turn ends first sweeps *everyone's* uncommitted work into one commit under one message. Before ending a turn, run `git status --short`: if it shows files you didn't touch, or `.next-commit-message.txt` already exists with text you didn't write, **don't overwrite that file** — commit only your own paths yourself (`git add <your files>` + `git commit` with your message and the attribution line), and leave the other session's files and message alone. Never stash, revert or "clean up" changes you didn't make.

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

**Shared test tooling** lives in `.claude/tools/` (static server `serve.sh`, Playwright `harness.js` with data mocks, localStorage seeding, iOS-standalone simulation and a standard health report). Install once with `npm install --prefix .claude/tools` (node_modules is gitignored; Chromium is already cached on this machine). How to use it, proven test recipes and Chromium's limits for iPhone-only bugs: skill `browser-testing`.

Note: agent definitions are loaded when a session starts, so a newly added or renamed agent only becomes available after restarting Claude Code. Skills are picked up immediately.

# Repo layout — products live in products/

All product pages moved out of the repo root into `products/` — every product has its own kebab-case folder, even a product that is just one HTML page. Inside each product folder, files are split into a subfolder per file type: `html/`, `css/`, `js/` (`.ts` sits next to its compiled `.js`) — only the ones that actually exist for that product — plus `data/` (bot-generated JSON), `json/` (hand-written seed JSON), or `py/` (CI-only Python scripts) when applicable. A page that supports one product but isn't a product of its own (e.g. VietLong Creator's privacy/terms pages) lives inside that product's own `html/`, not as a sibling in `products/`. See the `project-structure` skill for the full naming/structure rule this follows. Root now holds only `index.html` (with its own `css/index.css`, `js/index.js`, `img/og-image.jpg`), `products/`, and the four platform-forced files listed at the end of this section.

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

FuelTrack (`products/fuel-track/`, view-only PVOIL fuel prices for Đà Nẵng — no ledger, no P&L) copies GoldTrack's layout exactly: service worker shell `products/fuel-track/sw-fuel-track.js` sitting directly in the product folder, real logic in `products/fuel-track/js/sw-core.js` (`APP_CODE_PATHS` / `ICON_PATHS` / `DATA_PATHS`, `CACHE_NAME` + matching `?v=` in the shell — same bump rule as GoldTrack), absolute `register()` path. Its data comes from `giaxanghomnay.com/api/pvdate/YYYY-MM-DD` via `products/fuel-track/py/fetch_fuel_price.py` and `.github/workflows/update-fuel-price.yml`, because pvoil.com.vn sits behind a Cloudflare challenge no bot gets through. History stores only change points; the page forward-fills them per day. See `products/fuel-track/docs/fuel-track.md`.

LoveDays (`products/love-days/`, the couple's love-days tracker — private: robots Disallow + noindex, not in sitemap or the root index, README diagram only) copies the same layout: shell `products/love-days/sw-love-days.js`, logic in `js/sw-core.js` (`CACHE_NAME` `lovedays-cache-vN`; bump it together with the shell's `?v=` AND the `?v=` on `love-days-core.js` imported inside sw-core.js). All user data (photos included) lives on-device in IndexedDB `love-days`, opened ONLY via `LoveCore.openDb()` from `js/love-days-core.js`, a classic script shared by page and SW — a bare `indexedDB.open` from the SW would create an empty DB without stores. Daily Web Push comes from `.github/workflows/love-days-push.yml` + `products/love-days/py/send_push.py`; the VAPID private key and the device subscriptions live ONLY in GitHub secrets (`LOVE_VAPID_PRIVATE_KEY`, `LOVE_PUSH_SUBSCRIPTIONS`) — never write key material or subscription endpoints into the repo (public repo, and the Stop hook runs `git add -A`). See `products/love-days/docs/love-days.md`.

**Cache Storage is shared by the whole origin**, so each service worker's `activate` must only delete caches carrying its *own* prefix (`goldtrack-cache-`, `fueltrack-cache-`, `lovedays-cache-`). A bare `k !== CACHE_NAME` filter wipes every other product's offline cache.

This file (`CLAUDE.md`) must stay at the repo root so Claude Code auto-loads it. [README.md](README.md) also stays at root — GitHub only renders a repo's root `README.md` as its homepage on github.com, not one from a subfolder. `robots.txt` and `sitemap.xml` are the other two root exceptions: the Robots Exclusion Protocol requires `robots.txt` at the exact domain root to be found by crawlers, and `sitemap.xml` follows the same near-universal convention search engines expect by default. These four are the only root exceptions. Each product also has its own `docs/*.md` describing that product specifically (see `products/<name>/docs/`).

# Baseline for every web app in products/ (learned the hard way on GoldTrack)

Apply these when creating a product page, and check them whenever touching one that's meant to be used on a phone / added to the Home Screen. Details and measurements live in the skills named in brackets — read them before improvising a fix.

- **Status bar: `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, not `black-translucent`.** Measured on iPhone 14 Pro Max standalone: translucent mode draws from the top edge but reports a viewport 59pt short, so anything `position:fixed; bottom:0` floats 59pt above the real bottom and nothing painted below that line is visible. No CSS/`env()` fix exists; pushing elements down only clips them. Changing this tag requires removing and re-adding the Home Screen icon. [`ios-pwa-pitfalls` §1b]
- **Fonts must exist on iOS.** Cambria is a Windows/Office font; iPhones fall back to Georgia, whose iOS version only has old-style (up/down) digits, so `font-variant-numeric: lining-nums` does nothing and money amounts look broken. Any serif stack that starts with a non-iOS font needs the digits-only `@font-face` (unicode-range 0-9 → Cambria, else Times New Roman). Windows tests will never show this bug. [`ui-craft` §3]
- **A Home Screen app has its own storage, separate from Safari.** Data entered in Safari doesn't appear in the installed app. Any product that stores user data locally needs an empty state that says so, plus a way to move data (export/import or sync). [`ios-pwa-pitfalls` §14]
- **iOS-only layout can't be verified in Chromium** (no real safe-area, no standalone viewport). For such bugs, add a small on-device diagnostics line (screen/viewport size, safe-area insets via a `padding:env(...)` probe element, position of the fixed element) and ask the user for a screenshot instead of guessing. Say "chưa kiểm chứng trên máy thật" until you have it. [`ios-pwa-pitfalls` §1b, §13]
- **Service workers share one Cache Storage per origin**: `activate` may only delete caches with its own prefix (see the FuelTrack note above).
- **Charts and money displays**: don't stretch a chart's Y-axis to fit a far-away reference line (it flattens real moves); in a P&L view never show a number that double-counts or silently mixes realized with unrealized. [`ui-craft` §9-10]

# Product changelogs

Every product with an in-app version badge keeps a user-facing changelog at `products/<name>/data/changelog.json` (currently GoldTrack, FuelTrack and LoveDays, versioned independently). The rule below is written for GoldTrack but applies to each of them with their own files.

`products/gold-track/html/index.html` shows a version badge (top header, all tabs) that opens an in-app "Lịch sử cập nhật" popup reading from [products/gold-track/data/changelog.json](products/gold-track/data/changelog.json). This is a **user-facing** changelog, not raw commit messages — write entries in plain Vietnamese describing what changed for the user, not implementation detail.

**Whenever you make a user-visible change to GoldTrack** (any of `products/gold-track/html/index.html`, `products/gold-track/css/gold-track.css`, `products/gold-track/js/gold-track.js`, or the Python fetchers that feed it — new feature, fixed bug, redesign, but not internal refactors/comments), bump the version (increment the last segment, e.g. `1.10` → `1.11`) and prepend a new entry to `products/gold-track/data/changelog.json`'s `entries` array with that version, today's date, and 1-3 short bullet points. Update the top-level `"version"` field to match. The header badge and popup read this file directly — no code change needed elsewhere.

FuelTrack follows the same rule with its own `products/fuel-track/data/changelog.json` (versioned independently, starting at `1.0`). So does LoveDays with `products/love-days/data/changelog.json`.
