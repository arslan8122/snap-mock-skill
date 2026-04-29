---
description: Generate 6 Play Store mockup screenshots (1080×1920) + Feature Graphic (1024×500) from a local project directory.
argument-hint: <path-to-project>
---

# /snap-mock

The user invoked the `/snap-mock` slash command. Their argument (a local
project directory path) is in `$ARGUMENTS`.

## Step 0 — resolve the target

If `$ARGUMENTS` is empty:
- Default to the user's current working directory ONLY if it looks like a real
  project (has a `package.json`, `pubspec.yaml`, `build.gradle`, `Package.swift`,
  or `pyproject.toml` at the root).
- Otherwise, ask the user: *"Which local project should I generate mockups
  for? Pass a path, e.g. `/snap-mock /path/to/my-app`."* and stop.

**Force standalone mode when no argument was given.** When `$ARGUMENTS` is
empty and we fall back to cwd, the user means "mock me, don't touch me." Set
the env var `SNAP_MOCK_MODE=standalone` for the entire pipeline so scaffold.sh
uses the bundled renderer at `~/.snap-mock-renderer/` instead of auto-detecting
in-place mode against the user's project (which would copy plugin files into
their repo and hijack their dev server). The user can still opt into in-place
explicitly by passing the path AND running with `SNAP_MOCK_MODE=inplace` set in
their shell.

If `$ARGUMENTS` looks like a GitHub URL (starts with `https://github.com/` or
`git@github.com:`), tell the user the URL form is no longer supported and ask
for a local path. Stop.

## Step 1 — invoke the mockup-export skill

Run the full 7-step pipeline documented in
`${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/SKILL.md`. Do not skip steps. Do
not paraphrase. The pipeline is:

1. **Scaffold** — when `$ARGUMENTS` was empty (cwd fallback case), run
   `SNAP_MOCK_MODE=standalone bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/scaffold.sh`
   so we never modify the user's repo. When `$ARGUMENTS` was given, run plain
   `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/scaffold.sh` (auto
   mode picks standalone unless cwd happens to be a Konva project, but the
   target is the path argument so in-place is fine in that case).
   Then read `${CLAUDE_PLUGIN_DATA}/scaffold.env` for `APP_ROOT`.
2. **Analyze** — `OUT_DIR=./skill-output FILES_DIR=./skill-files bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/analyze-local.sh "$ARGUMENTS"`
3. **Synthesize briefs.json** — YOU do this directly (no helper scripts). Read
   `${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/references/PROMPT.md` and follow
   all five passes (Narrative Arc → Content Brief → Layout → Validation →
   Feature Graphic). Output exactly 6 `screenshots` + 1 `featureGraphic`.
4. **Atomic write** — to `${APP_ROOT}/public/briefs.json.tmp` then `mv` to
   `${APP_ROOT}/public/briefs.json`.
5. **Start dev** — `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/start-dev.sh`
   then `bash ${CLAUDE_PLUGIN_ROOT}/skills/mockup-export/scripts/wait-for-server.sh`.
6. **Export** — `cd "$APP_ROOT" && BRIEFS_GENERATED_AT="<your timestamp>" OUT_DIR="$USER_CWD/mockups" node scripts/export-screenshots.mjs`
7. **Report** — print absolute path to `./mockups/` and the 7 file names.

## Tone

Be terse. The user invoked a slash command — they want output, not narration.
Brief one-line updates between steps are fine; long explanations are not.

## Power-user env vars (no flags exposed; respected if set)

- `SNAP_MOCK_RENDERER_HOME=/path` — override standalone renderer location
  (default `~/.snap-mock-renderer`)
- `SNAP_MOCK_MODE=standalone|inplace` — force scaffold mode. Default: auto when
  `$ARGUMENTS` is given; FORCED to `standalone` when the user invokes
  `/snap-mock` with no argument (so cwd is treated as a target, never modified
  as a renderer).

## Output

7 files in `./mockups/`:
- `slot-01.png … slot-06.png` (1080×1920 each)
- `feature-graphic.png` (1024×500)
