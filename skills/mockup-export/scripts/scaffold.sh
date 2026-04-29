#!/usr/bin/env bash
# scaffold.sh — provision the Konva renderer the snap-mock plugin drives.
#
# Two modes:
#
# 1. STANDALONE (default, used when the user is NOT inside a Next.js + Konva project):
#    Materialize the bundled renderer from templates/renderer/ into ~/.snap-mock-renderer/.
#    Runs npm install + playwright chromium download on first provision.
#    Re-syncs source files when plugin templates change (detected via .snap-mock-version).
#    APP_ROOT becomes ~/.snap-mock-renderer/.
#
# 2. IN-PLACE (legacy, used when cwd or cwd/frontend has next + react + konva):
#    Copy individual library files into the existing project, print toolbar/page
#    patch instructions. Same behavior as snap-mock v0.1.
#
# Mode selection: if SNAP_MOCK_MODE=inplace is set, force in-place. Otherwise
# auto-detect: in-place when an existing Konva project is found, standalone
# when not. SNAP_MOCK_RENDERER_HOME overrides the default ~/.snap-mock-renderer
# location.
#
# Outputs $CLAUDE_PLUGIN_DATA/scaffold.env containing APP_ROOT=... so subsequent
# scripts (start-dev.sh, etc.) know where to operate.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../../.." && pwd)}"
TEMPLATES="$PLUGIN_ROOT/skills/mockup-export/templates"
RENDERER_TEMPLATE="$TEMPLATES/renderer"
USER_CWD="$(pwd)"
PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-/tmp/snap-mock-data}"
RENDERER_HOME_DEFAULT="${HOME}/.snap-mock-renderer"
RENDERER_HOME="${SNAP_MOCK_RENDERER_HOME:-$RENDERER_HOME_DEFAULT}"
SCAFFOLD_ENV="$PLUGIN_DATA/scaffold.env"

mkdir -p "$PLUGIN_DATA"

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    JSON_TOOL="python"
  else
    JSON_TOOL="jq"
  fi
}

read_pkg_field() {
  local field="$1" pkg="$2"
  if [ "$JSON_TOOL" = "jq" ]; then
    jq -r ".dependencies[\"$field\"] // .devDependencies[\"$field\"] // empty" "$pkg"
  else
    python3 -c "
import json
p = json.load(open('$pkg'))
v = (p.get('dependencies') or {}).get('$field') or (p.get('devDependencies') or {}).get('$field') or ''
print(v)
"
  fi
}

detect_inplace_root() {
  if [ -f "$USER_CWD/package.json" ]; then
    if [ -n "$(read_pkg_field 'konva' "$USER_CWD/package.json")" ]; then
      echo "$USER_CWD"; return 0
    fi
  fi
  if [ -f "$USER_CWD/frontend/package.json" ]; then
    if [ -n "$(read_pkg_field 'konva' "$USER_CWD/frontend/package.json")" ]; then
      echo "$USER_CWD/frontend"; return 0
    fi
  fi
  return 1
}

write_scaffold_env() {
  local app_root="$1" mode="$2"
  cat > "$SCAFFOLD_ENV" <<EOF
APP_ROOT=$app_root
SNAP_MOCK_MODE=$mode
EOF
  echo "[scaffold] wrote $SCAFFOLD_ENV (APP_ROOT=$app_root mode=$mode)"
}

# ============================================================================
# Mode 1: STANDALONE — bundled renderer at ~/.snap-mock-renderer/
# ============================================================================

standalone_template_hash() {
  # Hash the renderer template directory so we know when to re-sync.
  if [ -d "$RENDERER_TEMPLATE" ]; then
    find "$RENDERER_TEMPLATE" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.css" -o -name "*.mjs" \) \
      -exec shasum {} \; | sort | shasum | awk '{print $1}'
  else
    echo "missing"
  fi
}

standalone_sync_sources() {
  # Copy every file in templates/renderer/ into RENDERER_HOME, preserving tree.
  # OVERWRITES source files (so plugin upgrades take effect) but PRESERVES
  # node_modules/, .next/, public/briefs.json (if non-placeholder), and any
  # other user-touched files outside the template tree.
  echo "[scaffold] syncing renderer sources from $RENDERER_TEMPLATE -> $RENDERER_HOME"
  mkdir -p "$RENDERER_HOME"
  (cd "$RENDERER_TEMPLATE" && find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.css" -o -name "*.mjs" -o -name ".gitignore" \)) | while read -r rel; do
    rel="${rel#./}"
    src="$RENDERER_TEMPLATE/$rel"
    dst="$RENDERER_HOME/$rel"
    # Don't overwrite a real briefs.json the synthesizer wrote.
    if [ "$rel" = "public/briefs.json" ] && [ -f "$dst" ]; then
      if ! grep -q '"appName": "Placeholder"' "$dst" 2>/dev/null; then
        continue
      fi
    fi
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  done
}

standalone_install_deps() {
  cd "$RENDERER_HOME"
  if [ ! -d "node_modules" ] || [ ! -d "node_modules/next" ] || [ ! -d "node_modules/konva" ]; then
    echo "[scaffold] installing dependencies (first run, ~60s)"
    npm install --silent 2>&1 | tail -10 || {
      echo "[scaffold] error: npm install failed — re-run with 'cd $RENDERER_HOME && npm install' to debug" >&2
      exit 1
    }
  else
    echo "[scaffold] node_modules present — skipping npm install"
  fi
  if [ ! -d "node_modules/playwright" ]; then
    echo "[scaffold] error: playwright missing after install" >&2
    exit 1
  fi
  if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "[scaffold] downloading Chromium (~150 MB on first run, cached afterwards)"
    npx playwright install chromium 2>&1 | tail -3 || {
      echo "[scaffold] warning: chromium download failed — pipeline will fail at Step 6 until you run 'npx playwright install chromium' in $RENDERER_HOME"
    }
  fi
}

run_standalone() {
  echo "[scaffold] mode: STANDALONE — using bundled renderer at $RENDERER_HOME"

  if [ ! -d "$RENDERER_TEMPLATE" ] || [ ! -f "$RENDERER_TEMPLATE/package.json" ]; then
    echo "[scaffold] error: renderer template missing at $RENDERER_TEMPLATE" >&2
    echo "[scaffold] this plugin install is incomplete." >&2
    exit 1
  fi

  local current_hash version_file recorded_hash
  current_hash=$(standalone_template_hash)
  version_file="$RENDERER_HOME/.snap-mock-version"
  recorded_hash=""
  if [ -f "$version_file" ]; then
    recorded_hash=$(cat "$version_file" 2>/dev/null || echo "")
  fi

  if [ "$current_hash" != "$recorded_hash" ]; then
    standalone_sync_sources
    echo "$current_hash" > "$version_file"
  else
    echo "[scaffold] renderer sources up to date (hash $current_hash)"
  fi

  standalone_install_deps

  write_scaffold_env "$RENDERER_HOME" "standalone"
  echo "[scaffold] done. renderer at $RENDERER_HOME"
}

# ============================================================================
# Mode 2: IN-PLACE — legacy v0.1 behavior, copy library files only
# ============================================================================

inplace_manifest_init() {
  local manifest="$USER_CWD/.claude/skill-mockups.json"
  mkdir -p "$USER_CWD/.claude"
  if [ ! -f "$manifest" ]; then
    echo '{"createdBy":"snap-mock-skill","files":[]}' > "$manifest"
  fi
  INPLACE_MANIFEST="$manifest"
}

inplace_manifest_record() {
  local relpath="$1"
  python3 - <<PYEOF
import json
m = json.load(open("$INPLACE_MANIFEST"))
if "$relpath" not in m["files"]:
    m["files"].append("$relpath")
json.dump(m, open("$INPLACE_MANIFEST", "w"), indent=2)
PYEOF
}

inplace_copy_if_missing() {
  local src="$1" dest="$2" relpath="$3"
  if [ -e "$dest" ]; then
    echo "[scaffold]   skip (exists): $relpath"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    inplace_manifest_record "$relpath"
    echo "[scaffold]   wrote: $relpath"
  fi
}

inplace_upgrade_overwrite() {
  local src="$1" dest="$2" relpath="$3"
  if [ -e "$dest" ]; then
    local backup_dir="$USER_CWD/.claude/skill-mockups-backup"
    mkdir -p "$(dirname "$backup_dir/$relpath")"
    if [ ! -e "$backup_dir/$relpath" ]; then
      cp "$dest" "$backup_dir/$relpath"
      echo "[scaffold]   backed up: $relpath -> .claude/skill-mockups-backup/"
    fi
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  inplace_manifest_record "$relpath"
  echo "[scaffold]   wrote (upgrade): $relpath"
}

inplace_install_dep() {
  local dep="$1" save_flag="$2"
  cd "$APP_ROOT"
  local v
  v=$(read_pkg_field "$dep" "package.json")
  if [ -z "$v" ]; then
    echo "[scaffold] installing $dep"
    npm install $save_flag "$dep" --silent 2>&1 | tail -5 || {
      echo "[scaffold] warning: npm install $dep failed — please run it manually"
    }
  else
    echo "[scaffold] $dep already present ($v)"
  fi
}

run_inplace() {
  APP_ROOT="$1"
  echo "[scaffold] mode: IN-PLACE — using existing project at $APP_ROOT"

  cd "$APP_ROOT"
  local next_v react_v konva_v
  next_v=$(read_pkg_field "next" "package.json")
  react_v=$(read_pkg_field "react" "package.json")
  konva_v=$(read_pkg_field "konva" "package.json")
  echo "[scaffold] detected next=$next_v react=$react_v konva=$konva_v"

  inplace_manifest_init

  echo "[scaffold] copying templates into $APP_ROOT"
  inplace_copy_if_missing "$TEMPLATES/api-export-all-route.ts"           "$APP_ROOT/src/app/api/export-all/route.ts"           "src/app/api/export-all/route.ts"
  inplace_copy_if_missing "$TEMPLATES/api-render-screen-image-route.ts"  "$APP_ROOT/src/app/api/render-screen-image/route.ts"  "src/app/api/render-screen-image/route.ts"
  inplace_copy_if_missing "$TEMPLATES/api-render-screen-route.ts"        "$APP_ROOT/src/app/api/render-screen/route.ts"        "src/app/api/render-screen/route.ts"
  inplace_copy_if_missing "$TEMPLATES/loadBriefs.ts"                     "$APP_ROOT/src/lib/loadBriefs.ts"                     "src/lib/loadBriefs.ts"
  inplace_copy_if_missing "$TEMPLATES/BriefsBootstrapper.tsx"            "$APP_ROOT/src/components/mockup/BriefsBootstrapper.tsx" "src/components/mockup/BriefsBootstrapper.tsx"

  inplace_upgrade_overwrite "$TEMPLATES/meshGradient.ts"      "$APP_ROOT/src/lib/meshGradient.ts"      "src/lib/meshGradient.ts"
  inplace_upgrade_overwrite "$TEMPLATES/renderScreenshot.ts"  "$APP_ROOT/src/lib/renderScreenshot.ts"  "src/lib/renderScreenshot.ts"

  inplace_copy_if_missing "$PLUGIN_ROOT/skills/mockup-export/scripts/export-screenshots.mjs" "$APP_ROOT/scripts/export-screenshots.mjs" "scripts/export-screenshots.mjs"

  inplace_install_dep "jszip" ""
  inplace_install_dep "playwright" "-D"
  inplace_install_dep "adm-zip" "-D"
  if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    npx playwright install chromium 2>&1 | tail -3 || true
  fi

  if ! grep -q 'data-action="export-all-zip"' "$APP_ROOT/src/components/mockup/EditorToolbar.tsx" 2>/dev/null; then
    echo ""
    echo "[scaffold] ACTION REQUIRED: add the Export ZIP button to EditorToolbar.tsx"
    echo "[scaffold]   see $TEMPLATES/toolbar-patch-instructions.md"
  else
    echo "[scaffold] EditorToolbar.tsx already has Export ZIP button"
  fi

  if ! grep -q 'BriefsBootstrapper' "$APP_ROOT/src/app/page.tsx" 2>/dev/null; then
    echo ""
    echo "[scaffold] ACTION REQUIRED: mount <BriefsBootstrapper /> in src/app/page.tsx"
    echo "[scaffold]   see $TEMPLATES/page-patch-instructions.md"
  else
    echo "[scaffold] page.tsx already mounts BriefsBootstrapper"
  fi
  echo ""

  write_scaffold_env "$APP_ROOT" "inplace"
  echo "[scaffold] done. app root: $APP_ROOT"
}

# ============================================================================
# Entry point
# ============================================================================

main() {
  require_jq

  local forced_mode="${SNAP_MOCK_MODE:-auto}"
  if [ "$forced_mode" = "standalone" ]; then
    run_standalone
    return
  fi

  local detected_root
  if detected_root=$(detect_inplace_root); then
    if [ "$forced_mode" = "inplace" ] || [ "$forced_mode" = "auto" ]; then
      run_inplace "$detected_root"
      return
    fi
  fi

  run_standalone
}

main "$@"
