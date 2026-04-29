# Changelog

All notable changes to this plugin are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-04-29

### Added

- **`/snap-mock` slash command.** Explicit, deterministic invocation: `/snap-mock /path/to/your-project`. Autocompletes in Claude Code. The natural-language phrases ("snap mock …", "generate mockups for …") still trigger the skill via auto-match. Defined in `commands/snap-mock.md`.
- **No-argument safety guarantee.** Bare `/snap-mock` (no path) treats cwd as the target and forces `SNAP_MOCK_MODE=standalone`, so the bundled renderer at `~/.snap-mock-renderer/` is used and the user's project files are never copied into or modified — even when cwd is a Next.js + Konva app that would otherwise auto-trigger in-place mode.
- **Bundled renderer.** `templates/renderer/` ships a minimal Next.js + React + Konva app inside the plugin. Users no longer need a separate `ai-mockup-generator` checkout. On first run, `scaffold.sh` materializes the renderer at `~/.snap-mock-renderer/` (override with `SNAP_MOCK_RENDERER_HOME`), runs `npm install`, and downloads Chromium.
- **Feature Graphic.** Every run now produces `feature-graphic.png` (1024×500) alongside the 6 slot screenshots. The Feature Graphic reuses one of the slot's in-device renders via the new `source_slot` field — no extra render call, theme stays in sync.
- **Dual-mode `scaffold.sh`.** Auto-detects and chooses between two modes:
  - **Standalone** (default): uses bundled renderer at `~/.snap-mock-renderer/`.
  - **In-place** (auto when cwd or cwd/frontend has next + react + konva): legacy v0.1 behavior — copies library files into existing project.
  - Force with `SNAP_MOCK_MODE=standalone` or `SNAP_MOCK_MODE=inplace`.
- **`scaffold.env`.** `scaffold.sh` writes `APP_ROOT` to `${CLAUDE_PLUGIN_DATA}/scaffold.env`. `start-dev.sh` reads it automatically; subsequent steps reference it.
- **Template hash check.** Standalone renderer detects when plugin templates change (`.snap-mock-version` hash) and re-syncs source files automatically. `node_modules/` and user data preserved.
- **Renderer template assets.** 26 source files staged under `templates/renderer/`: minimal `page.tsx`, headless-only `EditorToolbar.tsx`, all API routes, store, layers, mesh gradient generator, font loader, device frame data.
- **Landscape-aware aurora & vignette.** `renderScreenshot.ts` now scales radial gradient blobs by the short axis so the 512×250 Feature Graphic canvas renders cleanly without overflowing blobs.
- **`featureGraphic` block in `briefs.example.json`** documenting the schema for synthesizers.
- **Updated `toolbar-patch-instructions.md`** to include the FG render branch and the `featureGraphic` field in the export-all POST body (in-place mode).
- **Preview screenshots** (`docs/preview/`) showing 6 slots + Feature Graphic generated against TradeCalcPro, used in the README.
- **`.gitignore`** at repo root.

### Changed

- `SKILL.md` Prerequisites and Step 1 rewritten for the standalone-first workflow.
- `marketplace.json` and `plugin.json` descriptions updated — the skill takes a local path now (not a GitHub URL).
- `loadBriefs.ts` adds `aiFeatureGraphicToStore`, the `featureGraphic` field to the briefs schema, and `source_slot` resolution that reuses an already-rendered slot screenshot.
- `mockupStore.ts` adds a top-level `featureGraphic` slot (lives outside `project.screenshots` so it survives reorder/delete) and a `setFeatureGraphic` action.
- `BriefsBootstrapper.tsx` hydrates `featureGraphic` from `briefs.json` in the same render pass as the 6 slots.
- `api/export-all/route.ts` accepts an optional `featureGraphic` field on the POST body and zips it as `feature-graphic.png` (backwards compatible — pre-FG payloads still produce a 6-file zip).

### Fixed

- `start-dev.sh` no longer requires the user to `cd` into the renderer; it reads `APP_ROOT` from `scaffold.env`.
- `export-screenshots.mjs` reports Feature Graphic in its summary line when present.

## [0.1.0] — 2026-04-27

Initial release.

- 6 Google Play Store slot screenshots from a GitHub URL.
- Konva-based renderer (driven via Playwright in headless Chromium).
- 3-pass synthesis prompt (content → layout → validation).
- Required an `ai-mockup-generator` checkout in cwd; copied templates into it.
- Toolbar + page patches applied manually by Claude on first run.
