---
name: mockup-export
description: Generate 6 Google Play Store mockup screenshots (1080x1920 PNG) PLUS a Feature Graphic (1024x500 PNG) by analyzing a LOCAL project directory. Triggers on phrases like "snap mock <path>", "generate mockups for this project", "play store screenshots from my code", "create app store mockups". Reads the entire target codebase (every text file, with sane skip patterns), so Claude has full repo understanding before synthesizing. Runs entirely in-session — no API key required, no GitHub access needed. Output lands in ./mockups/.
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
5. Unpacks the resulting zip into `./mockups/slot-01.png … slot-06.png` AND `./mockups/feature-graphic.png` (1024×500 banner).

## Prerequisites

- A **target directory** to analyze — passed as an argument to the skill (e.g. `/Users/me/projects/my-app`). Can be the user's cwd by default if no path is given.
- `node` (≥20), `npm`, and `python3` on PATH. No `gh`, no GitHub token, no internet required.
- First run downloads Chromium (~150 MB, cached at `~/.cache/ms-playwright`).

**The renderer is bundled.** The skill ships its own Konva renderer template at `${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/templates/renderer/`. On first run, `scaffold.sh` materializes it at `~/.snap-mock-renderer/` (override with `SNAP_MOCK_RENDERER_HOME`) and runs `npm install` once. Subsequent runs are fast — the renderer is reused. If the user is already inside an existing Next.js + React + Konva project, the script auto-detects that and uses **in-place mode** instead (legacy v0.1 behavior; copies library files into the existing project, prints toolbar/page patch instructions).

## Order of operations

When the user invokes you with a GitHub URL (e.g. "snap mock https://github.com/owner/repo"), do the following in order. Do not skip any step.

### Step 1 — Provision the renderer

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/scaffold.sh`.

This script auto-selects between two modes:

**STANDALONE mode (default — used when no Next.js + Konva project is in cwd or cwd/frontend):**
- Materializes the bundled renderer from `templates/renderer/` into `~/.snap-mock-renderer/` (override with `SNAP_MOCK_RENDERER_HOME`).
- Re-syncs source files when plugin templates change (detected via `.snap-mock-version` hash).
- Runs `npm install` and `npx playwright install chromium` on first run only.
- Writes `${CLAUDE_PLUGIN_DATA}/scaffold.env` with `APP_ROOT=$HOME/.snap-mock-renderer`.

**IN-PLACE mode (auto-detected when cwd or cwd/frontend has next + react + konva):**
- Copies five templates into the existing project (only if missing): the three API routes, `loadBriefs.ts`, `BriefsBootstrapper.tsx`, and `scripts/export-screenshots.mjs`.
- Upgrades `meshGradient.ts` and `renderScreenshot.ts` (backups go to `.claude/skill-mockups-backup/`).
- Installs `jszip`, `playwright`, `adm-zip` if missing.
- Records its writes in `.claude/skill-mockups.json`.
- Prints "ACTION REQUIRED" messages if `EditorToolbar.tsx` doesn't have the Export ZIP button or `page.tsx` doesn't mount `<BriefsBootstrapper />` — apply the patches in `templates/toolbar-patch-instructions.md` and `templates/page-patch-instructions.md` using the `Edit` tool.

Force standalone with `SNAP_MOCK_MODE=standalone bash …/scaffold.sh`. Force in-place with `SNAP_MOCK_MODE=inplace …`.

After scaffold, **read `${CLAUDE_PLUGIN_DATA}/scaffold.env`** to learn `APP_ROOT` for subsequent steps.

### Step 2 — Analyze the target directory

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/analyze-local.sh <target-directory>`.

If the user gave a `<github-url>` instead of a path, the URL form is no longer supported — ask them for the local path of the project they want mockups for.

This script writes:
- `./scratch/skill-output/manifest.json` — list of every text file in the project (with size), so Claude can request specific files later if needed
- `./scratch/skill-files/<encoded-path>` — captured contents for the first 200 files (truncated at 8KB each)
- `./scratch/skill-output/analysis.json` — prompt-ready bundle: `app_name`, `framework`, `description`, `topics`, `brand_colors`, `screens`, `readme_full`, `source_context`, `key_files`, `app_icon_local`

Override `OUT_DIR` / `FILES_DIR` env vars to relocate scratch output (recommended: write under the user's cwd, e.g. `OUT_DIR=./mockup-test/skill-output`).

Skip patterns enforced: `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `target`, `vendor`, `venv`, `__pycache__`, `ios/Pods`, `ios/build`, `android/build`, `android/.gradle`, `android/app/build`, `coverage`, `DerivedData`, `.expo`, `.xcworkspace`, `.xcodeproj`, plus binary file extensions (`.png`, `.ttf`, `.zip`, etc.) and lockfiles.

### Step 3 — Synthesize the briefs (Claude does this directly)

**You — Claude — perform this step yourself. Do NOT call a Python helper, generator script, or any other code to produce briefs.json. Do not reuse a previously generated briefs.json from another project.** This is reasoning work that must be redone for every target so the output is dynamically derived from THIS project's source.

1. `Read` `${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/references/PROMPT.md` — it contains the six-pass prompt (Narrative Arc → **Style Profile Extraction** → Content Brief → Layout Design → Validation → Feature Graphic).
2. `Read` `./scratch/skill-output/analysis.json` (or wherever `OUT_DIR` placed it).
3. `Read` `./scratch/skill-output/manifest.json` to identify files you still need.
4. For React Native targets, `Read` the navigator file directly — search the manifest for `_layout.tsx`, `Navigator`, or `App.tsx` and read it to extract the REAL tab labels and screen graph. Do not guess.
5. **For style extraction (PASS 0.5), `Read` 2–3 screen source files directly** — typically `src/screens/<Hero>Screen.tsx` plus any `theme.ts` / `colors.ts` / `tailwind.config.js` / `paperTheme.ts`. The `source_context` truncation in `analysis.json` is INSUFFICIENT for style extraction — `StyleSheet.create({...})` blocks often live below the 8KB cutoff. Read full files. The style profile (typography ramp, colors, gradients, spacing scale, shape, density, elevation, mood modifiers) **MUST** be extracted and ship as a top-level `style_profile` block in `briefs.json`.
6. `Read` 1–3 additional relevant screen source files when `source_context` doesn't give you enough text to write authentic `screen_ui` content (this is in addition to the style-extraction reads in step 5; one file can serve both purposes).
7. Run all six passes internally and produce ONE JSON object containing the `style_profile`, the 6 `screenshots`, AND the `featureGraphic` block.

**Inputs:**
- The full `analysis.json` you just wrote.
- `manifest.json` for file lookups.
- Any extra source files you `Read` from the target directory.
- The current ISO 8601 UTC timestamp (use `date -u +"%Y-%m-%dT%H:%M:%SZ"`) — you'll embed this as `generatedAt`.

**Output:** a single JSON object matching the `briefs.json` schema in PROMPT.md. **Output ONLY the JSON. No preamble, no code fences, no commentary.**

**Hardcoding ban (production-grade requirement):** every string AND every style value in the output must trace back to either (a) `analysis.json` from THIS run, or (b) a file you read from the target directory in this session. If you find yourself about to write a brand color, screen name, list-item label, headline, fontSize, padding, or corner_radius that came from a previous conversation or example, stop and re-derive it from the current source. The style ban is enforced: every `font_size` in your output must equal a `style_profile.type_ramp.<role>.size` value; every `corner_radius` must equal a `style_profile.shape.<key>` value; every `fill` color must equal `style_profile.colors.<key>` or appear in a `style_profile.gradients[].colors`. The renderer will silently snap mismatched values, so writing them wrong wastes effort.

**Asset ban (visuals come from the project only):** the only imagery allowed in the output is (a) `analysis.app_icon_url`, (b) the in-device screen render produced by `/api/render-screen-image`, and (c) entries from `analysis.project_assets`. Do NOT fetch external photos, generate AI images, or ship stock art. If the project has no usable illustrations/splash/hero assets, every slot uses solid color + texture only — that is the correct outcome, not a fallback.

**Headline copy rule (short by design):** headlines are 1 or 2 lines max, 2–5 words total, ≤20 characters per line, ALL CAPS. Single-line headlines are preferred. Examples: `"TRADE GRADE"`, `"STOP\nGUESSING"`, `"BUILD ANYTHING"`. Subtitles ≤35 characters, single line.

**Required top-level fields (in addition to `version`, `generatedAt`, `theme`, `screenshots`, `featureGraphic`):**
- `appName` — copy from `analysis.app_name`
- `appIconUrl` — copy verbatim from `analysis.app_icon_url` (a `data:image/...;base64,...` URL — already embedded by analyze-local.sh)
- `projectAssets` — copy `analysis.project_assets` verbatim ONLY if any `image_placeholder` element references one of its entries via `asset_url`. The runtime needs the array to resolve path → data_url at render time. Omit when no element uses it.
- `style_profile` — REQUIRED. Extracted by you in PASS 0.5 from the target's source files. See PROMPT.md PASS 0.5 for the full schema (`type_ramp`, `colors`, `gradients`, `spacing`, `shape`, `density`, `elevation`, `mood_modifiers`). The renderer reads this for every fontSize, padding, color, and radius — without it, the output reverts to generic defaults and the mockup won't look like the target app. Fill ALL required keys; partial profiles are rejected by PASS 3 validation.

**Theme colors:**
- Use `analysis.brand_colors[0]` as `primary_gradient_start`
- Use `analysis.brand_colors[1]` (or a darker shade of [0]) as `primary_gradient_end`
- Use `analysis.brand_colors[2]` (or the warmest of the palette) as `accent_color`
- `mesh_colors` should be 3 colors picked from `brand_colors`, ordered for visual flow

Validate before writing:
- Exactly 6 entries in `screenshots`.
- Each screenshot has at least 1 `background` layer first, at least 1 `text` layer, and at least 1 `device` layer.
- Every device-bearing screenshot's `screen_ui` is detailed (≥6 elements: status_bar, nav_bar, content elements, bottom_nav).
- Every headline is ≤2 lines, 2–5 words total, ≤20 chars per line. Subtitles ≤35 chars.
- No `text` layer where `x + width > 380`.
- Any image layer's source path or data_url MUST appear in `analysis.project_assets` or be `analysis.app_icon_url`.
- **Feature Graphic** (`featureGraphic` block): exactly ONE entry. Has `background` first, ≥1 `text`, ≥1 `device`. Every device layer has a non-empty `source_slot` matching one of the 6 `screenshots[].name` values verbatim. Headline ≤2 lines, ≤4 words total, ≤18 chars per line. No `text` layer where `x + width > 502`. See PASS 4 in PROMPT.md for archetype y-values and complete validation rules.

### Step 4 — Write briefs.json atomically

`APP_ROOT` is whatever Step 1 wrote to `${CLAUDE_PLUGIN_DATA}/scaffold.env` (`~/.snap-mock-renderer` in standalone mode, the user's existing project root in in-place mode).

Write to `${APP_ROOT}/public/briefs.json.tmp` first, then `mv` to `${APP_ROOT}/public/briefs.json`. POSIX rename is atomic on the same filesystem and prevents a mid-write race with `fetch('/briefs.json')`.

If `${APP_ROOT}/public/briefs.json` already exists with a different schema (no `version` field, or a `generatedAt` that's not ISO 8601), write to `${APP_ROOT}/public/briefs.claude.json` instead and tell the user. The standalone renderer ships a placeholder `briefs.json` (with `appName: "Placeholder"`) — overwrite that freely.

Remember the `generatedAt` value — Step 6 needs it.

### Step 5 — Start the dev server

Run `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/start-dev.sh`. The script reads `APP_ROOT` from `scaffold.env` automatically (no need to `cd` into it first).

Then `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/wait-for-server.sh` to block until the server returns 200 (timeout 30s).

If wait fails, `tail -50 ${CLAUDE_PLUGIN_DATA}/dev.log` and tell the user what went wrong.

### Step 6 — Drive the headless browser

The export script lives at `${APP_ROOT}/scripts/export-screenshots.mjs` (so it can resolve `playwright` from the app's own `node_modules/`). Run it from `APP_ROOT`:

```bash
APP_ROOT="$(grep '^APP_ROOT=' "$CLAUDE_PLUGIN_DATA/scaffold.env" | cut -d= -f2-)"
USER_CWD="$(pwd)"
cd "$APP_ROOT"
BRIEFS_GENERATED_AT="<the ISO timestamp from Step 4>" \
OUT_DIR="$USER_CWD/mockups" \
node scripts/export-screenshots.mjs
```

(`OUT_DIR` lands the PNGs at the user's original cwd, not inside the renderer.)

The script:
- Reads PORT from `${CLAUDE_PLUGIN_DATA}/dev.pid` line 2.
- Verifies `briefs.json` `generatedAt` matches `BRIEFS_GENERATED_AT` before clicking.
- Clicks `[data-action="export-all-zip"]`, captures the zip via `page.waitForEvent('download')`.
- Unpacks into `slot-01.png … slot-06.png` AND `feature-graphic.png` (1024×500).

### Step 7 — Report

Print the absolute path to `./mockups/` and a list of the 7 files: `slot-01.png … slot-06.png` (1080×1920 each) plus `feature-graphic.png` (1024×500). Don't tear down the dev server — the SessionEnd hook handles that automatically.

## Troubleshooting

- **Port 3000 occupied**: `start-dev.sh` falls through to 3137 automatically. If both are busy, kill the offender: `lsof -ti:3000 | xargs kill`.
- **Target directory not given**: ask the user for a path. The skill takes a *local directory* now, not a GitHub URL.
- **Chromium missing**: `scaffold.sh` runs `npx playwright install chromium` automatically. Retry if it failed (network).
- **briefs.json schema collision**: skill writes `briefs.claude.json` instead and tells the user.
- **Toolbar button not found**: scaffold prints "ACTION REQUIRED" — apply the patch in `templates/toolbar-patch-instructions.md`.
- **Wrong screens detected**: `analyze-local.sh` only matches files with `.dart`, `.ts`, `.tsx`, `.js`, `.jsx`, `.kt`, `.java`, `.swift` extensions and a `screen|page|view|activity|fragment` substring. Build artifacts (`.cmake`, `.json` from CodeGen, `.storyboard`) are filtered.
- **Mockups don't look like the target app (generic defaults)**: this means PASS 0.5 (style profile extraction) was skipped or partial. Confirm `briefs.json` has a complete `style_profile` block with all 8 sub-objects (`type_ramp`, `colors`, `gradients`, `spacing`, `shape`, `density`, `elevation`, `mood_modifiers`). If missing or thin, re-synthesize after explicitly reading 2–3 screen source files PLUS any theme file. The `source_context` truncation in `analysis.json` is too short for full `StyleSheet.create` blocks — read the actual files via the manifest.
- **Style profile present but mockups still wrong**: spot-check that `font_size` / `corner_radius` / `fill` values in `screenshots[].layers[]` actually match `style_profile` tokens. Common bug: synthesizer extracted the profile correctly but reverted to defaults when writing layers. Re-run PASS 3 validation rules 12–14.

## What this skill does NOT do (out of scope for v0.1)

- Per-slot regeneration
- Brand-kit / palette overrides via flags
- Repo-analysis caching (each invocation re-fetches)
- Watch mode
- App Store 1290×2796 sizing (Play Store 1080×1920 only)
- npm/pnpm/bun lockfile detection — assumes npm

## Future: Claude Design integration

Anthropic shipped Claude Design (https://claude.ai/design) on 2026-04-17. It generates polished HTML/CSS designs from briefs but has no public API and exports to PDF/PPTX/HTML, not PNG. So it can't replace the Konva pipeline directly.

**One-time use case (recommended for high-value clients):** spend ~20 prompts on Claude Design to generate a reference layout for one slot of the app, export the HTML, then mine it for exact gradient stops, type ramp, nav icon SVGs, and shadow values. Bake those constants into the templates as design-system overrides via a future `--design-system <claude-design-export.html>` flag (not yet implemented).
