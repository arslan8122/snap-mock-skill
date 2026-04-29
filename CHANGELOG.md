# Changelog

All notable changes to this plugin are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-04-29

### Added

- **Style profile extraction (PASS 0.5).** Claude now reads 2–3 of the target app's screen source files plus any theme file during synthesis and emits a complete `style_profile` block in `briefs.json`. Profile schema: `type_ramp` (display/title/body/caption with size+weight+family+letter_spacing), `colors` (primary/secondary/accent/background/surface/labelPrimary/labelSecondary/separator), `gradients` (named LinearGradient extractions), `spacing`, `shape`, `density`, `elevation`, `mood_modifiers` (uppercase_buttons, letter_spaced_titles, text_shadows, bold_outlines, drop_caps). Defined in `references/PROMPT.md` PASS 0.5; required fields enforced by PASS 3 validation rules 12–14.
- **Profile-driven HTML rendering.** `render-screen/route.ts` now consumes `style_profile` and applies the target's actual fontSize, weight, family, letter spacing, color tokens, gradient definitions, corner radii, density (row heights, button heights, tab bar heights), and mood modifiers. The `nav_bar`, `hero_banner`, `list_item`, `card`, `button`, `chip_row`, and `bottom_nav` element renderers all honor profile tokens. Body chrome (font stack, page background, tab bar height) also derives from profile.
- **Defensive `profileOrDefault()` merge.** Server route accepts partial profiles and fills missing keys from `DEFAULT_PROFILE` so degraded synthesizer output still renders cleanly.
- **`gradientCss()` helper.** Resolves named profile gradients (e.g. `page_bg`, `primary_cta`) to CSS `linear-gradient(angle, ...)`. Used by `hero_banner` and `button` so they adopt the target app's actual brand gradient when one was extracted.
- **`resolveFontStack()` helper.** Converts `"System"` font-family declarations into the iOS+Android stack (`-apple-system, BlinkMacSystemFont, …`) so device frames pick the right native font. Custom families (`"Manrope"`, `"Roboto Flex"`) get quoted and prepended.
- **`StyleProfile` TypeScript types in `loadBriefs.ts`** with full required-field schema. Plus `DEFAULT_STYLE_PROFILE` export for any future code that needs a documented baseline.
- **`styleProfile` slot in `mockupStore.ts`** (with `setStyleProfile` action and `loadTemplate` field) so the editor app can read the profile if it ever wants to apply it client-side. `BriefsBootstrapper` hydrates it from `briefs.style_profile` and forwards it to `/api/render-screen-image`.
- **`style_profile` forwarding in `render-screen-image/route.ts`** so the upstream Playwright invocation passes the profile through to `render-screen` for every slot's in-device render.

### Changed

- `SKILL.md` Step 3 now describes a **six-pass** synthesis (was five-pass), with PASS 0.5 inserted before content-brief authoring. Synthesizers must read 2–3 screen source files directly — `analysis.json` `source_context` is too truncated to extract full `StyleSheet.create` blocks. Hardcoding ban extended to style values: every fontSize, padding, corner_radius, and color in screen layers must trace back to a `style_profile` token.
- `PROMPT.md` validation rules expanded from 11 to 14: STYLE PROFILE COMPLETENESS (rule 12), STYLE PROFILE FIDELITY (rule 13), MOOD CONSISTENCY (rule 14).
- `PROMPT.md` `FINAL OUTPUT SCHEMA` now includes a complete example `style_profile` block (modeled on a game-style RN app — uppercase buttons, letter-spaced titles, gold accent, deep-blue gradient page background).
- `SKILL.md` Required top-level fields list now includes `style_profile`. Added two new troubleshooting entries for missing or partial profiles.

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
