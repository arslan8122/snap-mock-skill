---
name: mockup-export
description: Generate 6 Google Play Store mockup screenshots (1080x1920 PNG) from any GitHub URL. Triggers on phrases like "generate mockups from github", "play store screenshots", "create app store mockups", "snap mock", or when the user gives a github.com URL and asks for marketing screenshots. Runs entirely in-session — no API key required, no browser interaction needed. Output lands in ./mockups/.
keywords:
  - mockup
  - mockups
  - screenshot
  - screenshots
  - play store
  - app store
  - github url
  - marketing
  - snap mock
---

# Mockup Export Skill

Generate 6 Google Play Store mockup screenshots from any GitHub repo URL.

## What this skill does

1. Analyzes a GitHub repo (README, source code, framework, brand colors) using `gh` CLI / curl — no API key needed.
2. Reads `references/PROMPT.md` and synthesizes 6 mockup briefs (headlines, layouts, themes, screen UI) from the analysis bundle.
3. Writes `public/briefs.json` in the user's existing Next.js + Konva app.
4. Starts the Next.js dev server, drives a headless Chromium via Playwright to click the "Export ZIP" button.
5. Unpacks the resulting zip into `./mockups/slot-01.png … slot-06.png`.

## Prerequisites

- The user MUST be inside (or have `cd`'d into) their `ai-mockup-generator` checkout, OR a Next.js + React + Konva project with the same structure.
- `node` and `npm` on PATH.
- Either `gh auth login` done, or `$GITHUB_TOKEN` set, or the target repo is public (60 req/hr unauthenticated rate limit).
- First run downloads Chromium (~150 MB, cached at `~/.cache/ms-playwright`).

## Order of operations

When the user invokes you with a GitHub URL (e.g. "snap mock https://github.com/owner/repo"), do the following in order. Do not skip any step.

### Step 1 — Locate and verify the user's app

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/scaffold.sh`.

This script:
- Locates the app root (cwd or `cwd/frontend/`).
- Refuses to proceed unless `next`, `react`, and `konva` are dependencies.
- Copies `templates/api-export-all-route.ts` to `${APP_ROOT}/src/app/api/export-all/route.ts` (only if missing).
- Copies `scripts/export-screenshots.mjs` to `${APP_ROOT}/scripts/export-screenshots.mjs` (only if missing).
- Installs `jszip`, `playwright`, `adm-zip` if missing.
- Records its writes in `.claude/skill-mockups.json`.

If the script prints "ACTION REQUIRED: add the Export ZIP button to EditorToolbar.tsx", read `templates/toolbar-patch-instructions.md` and apply the patch using the `Edit` tool. The button MUST have `data-action="export-all-zip"` — Playwright clicks it by that selector.

### Step 2 — Analyze the repo

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/analyze-repo.sh <github-url>`.

This script writes:
- `./scratch/skill-output/repo_info.json` — repo metadata
- `./scratch/skill-output/tree.json` — full file tree
- `./scratch/skill-output/selected_files.txt` — Tier A/B/C/D ranked file paths
- `./scratch/skill-files/<encoded-path>` — file contents (truncated to 5KB each)
- `./scratch/skill-output/analysis.json` — final prompt-ready bundle

Override `OUT_DIR` and `FILES_DIR` env vars if you want a different scratch location.

### Step 3 — Synthesize the briefs

Read `${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/references/PROMPT.md`. It contains a three-pass prompt (Content Brief → Layout Design → Validation). Run all three passes internally and combine into one JSON output.

**Inputs to the prompt:**
- The full `./scratch/skill-output/analysis.json` you just wrote.
- The current ISO 8601 UTC timestamp (use `date -u +"%Y-%m-%dT%H:%M:%SZ"`) — you'll embed this as `generatedAt`.

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

## File-ranking heuristic (for reference, used by analyze-repo.sh)

```
Tier A — always include if present:
  README*, package.json, pyproject.toml, requirements*.txt, Cargo.toml, go.mod,
  tsconfig.json, next.config.*, vite.config.*, Dockerfile, docker-compose.y*ml,
  pubspec.yaml, app.json, expo.json
Tier B — entry points (first match wins):
  src/index.{ts,tsx,js}, src/main.{ts,py,go}, src/App.{tsx,jsx},
  app/page.tsx, app/layout.tsx, src/app/page.tsx,
  main.py, __main__.py, cmd/*/main.go, lib/main.dart
Tier C — config/CI: .github/workflows/*.yml, prisma/schema.prisma, tailwind.config.*
Tier D — fill remaining (up to 15 total): shallowest source files,
         priority .ts > .tsx > .py > .go > .rs > .dart > .js > .jsx > .kt > .java > .swift,
         bonus for paths matching screen|page|view|activity|fragment
```

## Troubleshooting

- **Port 3000 occupied**: `start-dev.sh` falls through to 3137 automatically. If both are busy, kill the offender: `lsof -ti:3000 | xargs kill`.
- **gh not authenticated**: skill falls through to `$GITHUB_TOKEN`, then to unauthenticated curl (60 req/hr). For private repos, run `gh auth login` first.
- **Chromium missing**: `scaffold.sh` runs `npx playwright install chromium` automatically. Retry if it failed (network).
- **briefs.json schema collision**: skill writes `briefs.claude.json` instead and tells the user.
- **Toolbar button not found**: scaffold prints "ACTION REQUIRED" — apply the patch in `templates/toolbar-patch-instructions.md`.

## What this skill does NOT do (out of scope for v0.1)

- Per-slot regeneration
- Brand-kit / palette overrides via flags
- Repo-analysis caching (each invocation re-fetches)
- Watch mode
- App Store 1290×2796 sizing (Play Store 1080×1920 only)
- npm/pnpm/bun lockfile detection — assumes npm
