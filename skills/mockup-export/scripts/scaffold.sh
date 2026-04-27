#!/usr/bin/env bash
# scaffold.sh — non-destructive setup of the user's Next.js app for the mockup plugin
# Reads ./package.json, refuses to proceed unless Next.js + React + Konva are present,
# copies templates only when targets don't already exist, records writes in .claude/skill-mockups.json.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../../.." && pwd)}"
TEMPLATES="$PLUGIN_ROOT/skills/mockup-export/templates"
USER_CWD="$(pwd)"
MANIFEST="$USER_CWD/.claude/skill-mockups.json"

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "[scaffold] jq not found — falling back to python for JSON parsing"
    JSON_TOOL="python"
  else
    JSON_TOOL="jq"
  fi
}

read_pkg_field() {
  local field="$1"
  if [ "$JSON_TOOL" = "jq" ]; then
    jq -r ".dependencies[\"$field\"] // .devDependencies[\"$field\"] // empty" package.json
  else
    python3 -c "
import json
p = json.load(open('package.json'))
v = (p.get('dependencies') or {}).get('$field') or (p.get('devDependencies') or {}).get('$field') or ''
print(v)
"
  fi
}

# Locate the Next.js app root.
# Pattern A: cwd has package.json with next/react/konva deps.
# Pattern B: cwd has a frontend/ subdir with that package.json (matches ai-mockup-generator layout).
locate_app_root() {
  if [ -f "package.json" ]; then
    APP_ROOT="$USER_CWD"
  elif [ -f "frontend/package.json" ]; then
    APP_ROOT="$USER_CWD/frontend"
    echo "[scaffold] using frontend/ subdir as app root"
  else
    echo "[scaffold] error: no package.json found at $USER_CWD or $USER_CWD/frontend" >&2
    echo "[scaffold] cd into your ai-mockup-generator checkout (or its frontend/ dir) before invoking the skill." >&2
    exit 1
  fi
}

verify_app() {
  cd "$APP_ROOT"
  require_jq

  local next_v react_v konva_v
  next_v=$(read_pkg_field "next")
  react_v=$(read_pkg_field "react")
  konva_v=$(read_pkg_field "konva")

  if [ -z "$next_v" ]; then
    echo "[scaffold] error: 'next' is not a dependency in $APP_ROOT/package.json" >&2
    echo "[scaffold] this plugin requires the existing ai-mockup-generator app (Next.js + React + Konva)." >&2
    exit 1
  fi
  if [ -z "$react_v" ]; then
    echo "[scaffold] error: 'react' is not a dependency in $APP_ROOT/package.json" >&2
    exit 1
  fi
  if [ -z "$konva_v" ]; then
    echo "[scaffold] error: 'konva' is not a dependency in $APP_ROOT/package.json" >&2
    echo "[scaffold] this plugin only works inside an app that already uses Konva for canvas rendering." >&2
    exit 1
  fi

  echo "[scaffold] detected next=$next_v react=$react_v konva=$konva_v"
}

manifest_init() {
  mkdir -p "$USER_CWD/.claude"
  if [ ! -f "$MANIFEST" ]; then
    echo '{"createdBy":"snap-mock-skill","files":[]}' > "$MANIFEST"
  fi
}

manifest_record() {
  local relpath="$1"
  python3 - <<PYEOF
import json
m = json.load(open("$MANIFEST"))
if "$relpath" not in m["files"]:
    m["files"].append("$relpath")
json.dump(m, open("$MANIFEST", "w"), indent=2)
PYEOF
}

copy_if_missing() {
  local src="$1" dest="$2" relpath="$3"
  if [ -e "$dest" ]; then
    echo "[scaffold]   skip (exists): $relpath"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    manifest_record "$relpath"
    echo "[scaffold]   wrote: $relpath"
  fi
}

install_zip_dep() {
  cd "$APP_ROOT"
  require_jq
  local jszip_v
  jszip_v=$(read_pkg_field "jszip")
  if [ -z "$jszip_v" ]; then
    echo "[scaffold] installing jszip"
    npm install jszip --silent 2>&1 | tail -5 || {
      echo "[scaffold] warning: npm install jszip failed — please run it manually"
    }
  else
    echo "[scaffold] jszip already in dependencies ($jszip_v)"
  fi
}

install_playwright_dep() {
  cd "$APP_ROOT"
  require_jq
  local pw_v
  pw_v=$(read_pkg_field "playwright")
  if [ -z "$pw_v" ]; then
    echo "[scaffold] installing playwright + adm-zip (devDeps)"
    npm install -D playwright adm-zip --silent 2>&1 | tail -5 || {
      echo "[scaffold] warning: npm install -D playwright failed — please run it manually"
    }
    echo "[scaffold] downloading Chromium (~150 MB on first run, cached afterwards)"
    npx playwright install chromium 2>&1 | tail -3 || true
  else
    echo "[scaffold] playwright already in devDependencies ($pw_v)"
  fi
}

main() {
  locate_app_root
  verify_app
  manifest_init

  echo "[scaffold] copying templates into $APP_ROOT"
  copy_if_missing \
    "$TEMPLATES/api-export-all-route.ts" \
    "$APP_ROOT/src/app/api/export-all/route.ts" \
    "src/app/api/export-all/route.ts"

  copy_if_missing \
    "$TEMPLATES/loadBriefs.ts" \
    "$APP_ROOT/src/lib/loadBriefs.ts" \
    "src/lib/loadBriefs.ts"

  copy_if_missing \
    "$TEMPLATES/BriefsBootstrapper.tsx" \
    "$APP_ROOT/src/components/mockup/BriefsBootstrapper.tsx" \
    "src/components/mockup/BriefsBootstrapper.tsx"

  copy_if_missing \
    "$PLUGIN_ROOT/skills/mockup-export/scripts/export-screenshots.mjs" \
    "$APP_ROOT/scripts/export-screenshots.mjs" \
    "scripts/export-screenshots.mjs"

  install_zip_dep
  install_playwright_dep

  # Toolbar patch is informational — the user (or Claude) edits it manually.
  local needs_patch=0
  if ! grep -q 'data-action="export-all-zip"' "$APP_ROOT/src/components/mockup/EditorToolbar.tsx" 2>/dev/null; then
    echo ""
    echo "[scaffold] ACTION REQUIRED: add the Export ZIP button to EditorToolbar.tsx"
    echo "[scaffold]   see $TEMPLATES/toolbar-patch-instructions.md"
    needs_patch=1
  else
    echo "[scaffold] EditorToolbar.tsx already has Export ZIP button"
  fi

  if ! grep -q 'BriefsBootstrapper' "$APP_ROOT/src/app/page.tsx" 2>/dev/null; then
    echo ""
    echo "[scaffold] ACTION REQUIRED: mount <BriefsBootstrapper /> in src/app/page.tsx"
    echo "[scaffold]   see $TEMPLATES/page-patch-instructions.md"
    needs_patch=1
  else
    echo "[scaffold] page.tsx already mounts BriefsBootstrapper"
  fi
  echo ""

  echo "[scaffold] done. app root: $APP_ROOT"
}

main "$@"
