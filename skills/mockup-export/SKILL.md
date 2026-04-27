---
name: mockup-export
description: Generate 6 Google Play Store mockup screenshots (1080x1920 PNG) by analyzing a LOCAL project directory. Triggers on phrases like "snap mock <path>", "generate mockups for this project", "play store screenshots from my code", "create app store mockups". Reads the entire target codebase (every text file, with sane skip patterns), so Claude has full repo understanding before synthesizing. Runs entirely in-session — no API key required, no GitHub access needed. Output lands in ./mockups/.
keywords:
  - mockup
  - mockups
  - screenshot
  - screenshots
  - play store
  - app store
  - local project
  - directory
  - marketing
  - snap mock
---

# Mockup Export Skill

Generate 6 Google Play Store mockup screenshots by analyzing a **local project directory**.

## What this skill does

1. Walks the target directory (every text file, skipping `node_modules`, `ios/Pods`, build outputs, binaries, lockfiles, etc.) and writes a manifest + a captured-source bundle.
2. Reads `references/PROMPT.md` and synthesizes 6 mockup briefs (headlines, layouts, themes, screen UI) using full-repo context.
3. Writes `public/briefs.json` in the user's existing Next.js + Konva app.
4. Starts the Next.js dev server, drives a headless Chromium via Playwright to click the "Export ZIP" button.
5. Unpacks the resulting zip into `./mockups/slot-01.png … slot-06.png`.

## Prerequisites

- The user MUST be inside (or have `cd`'d into) their `ai-mockup-generator` checkout, OR a Next.js + React + Konva project with the same structure (this is the *renderer*, not the target being analyzed).
- A **target directory** to analyze — passed as an argument to the skill (e.g. `/Users/me/projects/my-app`). Can be the user's cwd by default if no path is given.
- `node`, `npm`, and `python3` on PATH. No `gh`, no GitHub token, no internet required.
- First run downloads Chromium (~150 MB, cached at `~/.cache/ms-playwright`).

## Order of operations

When the user invokes you with a GitHub URL (e.g. "snap mock https://github.com/owner/repo"), do the following in order. Do not skip any step.

### Step 1 — Locate and verify the user's app

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/scaffold.sh`.

This script:
- Locates the app root (cwd or `cwd/frontend/`).
- Refuses to proceed unless `next`, `react`, and `konva` are dependencies.
- Copies four templates (only if missing):
  - `templates/api-export-all-route.ts` → `${APP_ROOT}/src/app/api/export-all/route.ts`
  - `templates/loadBriefs.ts` → `${APP_ROOT}/src/lib/loadBriefs.ts`
  - `templates/BriefsBootstrapper.tsx` → `${APP_ROOT}/src/components/mockup/BriefsBootstrapper.tsx`
  - `scripts/export-screenshots.mjs` → `${APP_ROOT}/scripts/export-screenshots.mjs`
- Installs `jszip`, `playwright`, `adm-zip` if missing.
- Records its writes in `.claude/skill-mockups.json`.

If the script prints either of the "ACTION REQUIRED" messages, apply the corresponding patch using the `Edit` tool — both are mandatory:

1. **Toolbar patch** — read `templates/toolbar-patch-instructions.md` and add the `Export ZIP` button to `EditorToolbar.tsx`. Required `data-action="export-all-zip"` attribute (Playwright clicks by that selector).
2. **Page patch** — read `templates/page-patch-instructions.md` and mount `<BriefsBootstrapper />` near the top of the editor JSX in `src/app/page.tsx`. Without this, `briefs.json` is never loaded into the store and the canvas keeps showing the default empty screenshot.

### Step 2 — Analyze the target directory

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/analyze-local.sh <target-directory>`.

If the user gave a `<github-url>` instead of a path, the URL form is no longer supported — ask them for the local path of the project they want mockups for.

This script writes:
- `./scratch/skill-output/manifest.json` — list of every text file in the project (with size), so Claude can request specific files later if needed
- `./scratch/skill-files/<encoded-path>` — captured contents for the first 200 files (truncated at 8KB each)
- `./scratch/skill-output/analysis.json` — prompt-ready bundle: `app_name`, `framework`, `description`, `topics`, `brand_colors`, `screens`, `readme_full`, `source_context`, `key_files`, `app_icon_local`

Override `OUT_DIR` / `FILES_DIR` env vars to relocate scratch output (recommended: write under the user's cwd, e.g. `OUT_DIR=./mockup-test/skill-output`).

Skip patterns enforced: `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `target`, `vendor`, `venv`, `__pycache__`, `ios/Pods`, `ios/build`, `android/build`, `android/.gradle`, `android/app/build`, `coverage`, `DerivedData`, `.expo`, `.xcworkspace`, `.xcodeproj`, plus binary file extensions (`.png`, `.ttf`, `.zip`, etc.) and lockfiles.

### Step 3 — Synthesize the briefs

Read `${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/references/PROMPT.md`. It contains a three-pass prompt (Content Brief → Layout Design → Validation). Run all three passes internally and combine into one JSON output.

**Inputs to the prompt:**
- The full `analysis.json` you just wrote.
- `manifest.json` if you need to ask for files outside the captured 200 (use `Read` on `<target-dir>/<path>` directly — they're on disk).
- The current ISO 8601 UTC timestamp (use `date -u +"%Y-%m-%dT%H:%M:%SZ"`) — you'll embed this as `generatedAt`.

If the captured `source_context` doesn't tell you enough about a particular screen, look it up by reading the actual file at `<target_dir>/src/screens/<ScreenName>Screen.tsx` (or equivalent). The full repo is on the user's disk — `Read` it directly when needed.

**Output:** a single JSON object matching the `briefs.json` schema in PROMPT.md. **Output ONLY the JSON. No preamble, no code fences, no commentary.**

Validate before writing:
- Exactly 6 entries in `screenshots`.
- Each screenshot has at least 1 `background` layer first and at least 1 `text` layer.
- No headline line longer than 12 chars; no subtitle longer than 35 chars.
- No `text` layer where `x + width > 380`.

### Step 4 — Write briefs.json atomically

Write to `${APP_ROOT}/public/briefs.json.tmp` first, then `mv` to `${APP_ROOT}/public/briefs.json`. POSIX rename is atomic on the same filesystem and prevents a mid-write race with `fetch('/briefs.json')`.

If `${APP_ROOT}/public/briefs.json` already exists with a different schema (no `version` field, or a `generatedAt` that's not ISO 8601), write to `${APP_ROOT}/public/briefs.claude.json` instead and tell the user.

Remember the `generatedAt` value — Step 6 needs it.

### Step 5 — Start the dev server

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/start-dev.sh` in the user's app root (cd into it first, or set `APP_ROOT`).

Then `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/wait-for-server.sh` to block until the server returns 200 (timeout 30s).

If wait fails, `tail -50 ${CLAUDE_PLUGIN_DATA}/dev.log` and tell the user what went wrong.

### Step 6 — Drive the headless browser

```bash
cd <user-app-root>
BRIEFS_GENERATED_AT="<the ISO timestamp from Step 4>" \
OUT_DIR="$OLDPWD/mockups" \
node scripts/export-screenshots.mjs
```

(`OUT_DIR` lands the PNGs at the user's original cwd, not inside the frontend.)

The script:
- Reads PORT from `${CLAUDE_PLUGIN_DATA}/dev.pid` line 2.
- Verifies `briefs.json` `generatedAt` matches `BRIEFS_GENERATED_AT` before clicking.
- Clicks `[data-action="export-all-zip"]`, captures the zip via `page.waitForEvent('download')`.
- Unpacks into `slot-01.png … slot-06.png`.

### Step 7 — Report

Print the absolute path to `./mockups/` and a list of the 6 PNG sizes. Don't tear down the dev server — the SessionEnd hook handles that automatically.

## Troubleshooting

- **Port 3000 occupied**: `start-dev.sh` falls through to 3137 automatically. If both are busy, kill the offender: `lsof -ti:3000 | xargs kill`.
- **Target directory not given**: ask the user for a path. The skill takes a *local directory* now, not a GitHub URL.
- **Chromium missing**: `scaffold.sh` runs `npx playwright install chromium` automatically. Retry if it failed (network).
- **briefs.json schema collision**: skill writes `briefs.claude.json` instead and tells the user.
- **Toolbar button not found**: scaffold prints "ACTION REQUIRED" — apply the patch in `templates/toolbar-patch-instructions.md`.
- **Wrong screens detected**: `analyze-local.sh` only matches files with `.dart`, `.ts`, `.tsx`, `.js`, `.jsx`, `.kt`, `.java`, `.swift` extensions and a `screen|page|view|activity|fragment` substring. Build artifacts (`.cmake`, `.json` from CodeGen, `.storyboard`) are filtered.

## What this skill does NOT do (out of scope for v0.1)

- Per-slot regeneration
- Brand-kit / palette overrides via flags
- Repo-analysis caching (each invocation re-fetches)
- Watch mode
- App Store 1290×2796 sizing (Play Store 1080×1920 only)
- npm/pnpm/bun lockfile detection — assumes npm
