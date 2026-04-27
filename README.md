# snap-mock-skill

Generate 6 Google Play Store mockup screenshots from any GitHub repo URL — without leaving the terminal.

A Claude Code plugin for the [ai-mockup-generator](https://github.com/datics-ai/ai-mockup-generator) app. Replaces the web UI with a one-shot in-session workflow: point at a GitHub URL, get 6 PNGs in `./mockups/`.

## Install

```
/plugin marketplace add arslan8122/snap-mock-skill
/plugin install snap-mock-skill@snap-mock-skill
```

## Use

`cd` into your `ai-mockup-generator` checkout (or its `frontend/` directory), then in Claude Code say:

> snap mock https://github.com/owner/some-repo

The skill will:

1. Verify the app (`next` + `react` + `konva` must be in `package.json`).
2. Install `jszip`, `playwright`, `adm-zip` if missing; download Chromium on first run (~150 MB, cached).
3. Add `/api/export-all/route.ts` to the app (only if not already present).
4. Analyze the GitHub URL via `gh` / `curl` / `raw.githubusercontent.com`.
5. Synthesize 6 mockup briefs using a 3-pass prompt (content → layout → validation).
6. Write `public/briefs.json` atomically.
7. Start `next dev` in the background, drive headless Chromium to click "Export ZIP".
8. Unzip into `./mockups/slot-01.png … slot-06.png`.

The dev server is killed automatically on session end via a `SessionEnd` hook.

## Prerequisites

- A local clone of [`ai-mockup-generator`](https://github.com/datics-ai/ai-mockup-generator) with the `Export ZIP` button added to `EditorToolbar.tsx` (the skill prompts you to apply this patch on first run; see `skills/mockup-export/templates/toolbar-patch-instructions.md`).
- Node.js + npm.
- Either `gh auth login` done, or `$GITHUB_TOKEN` set, or a public target repo.

## Output schema

Every screenshot is rendered at **1080 × 1920** (Play Store) by Konva. Files land at:

```
./mockups/slot-01.png
./mockups/slot-02.png
./mockups/slot-03.png
./mockups/slot-04.png
./mockups/slot-05.png
./mockups/slot-06.png
```

## Troubleshooting

- **Port 3000 busy**: skill falls through to 3137 automatically. If both busy: `lsof -ti:3000 | xargs kill`.
- **gh not authenticated**: skill uses `$GITHUB_TOKEN` if set, otherwise unauthenticated curl (60 req/hr). For private repos, `gh auth login` first.
- **Chromium download failed**: `cd frontend && npx playwright install chromium` manually, then re-invoke the skill.
- **`briefs.json` schema collision**: skill writes `briefs.claude.json` instead and tells you.
- **Background `next dev` still running after session ends**: `lsof -ti:3000 | xargs kill -9`.

## Roadmap (v1.0)

- Per-slot regeneration: `--slot 3 --regenerate`
- Brand-kit / palette overrides
- Repo-analysis caching at `${CLAUDE_PLUGIN_DATA}/cache/`
- Watch mode (re-export on `briefs.json` change)
- App Store 1290 × 2796 in addition to Play Store 1080 × 1920
- pnpm / bun lockfile detection

## License

MIT — see [LICENSE](./LICENSE).
