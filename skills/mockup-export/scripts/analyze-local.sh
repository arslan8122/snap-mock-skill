#!/usr/bin/env bash
# analyze-local.sh — scan a local directory for mockup-brief synthesis.
# Walks the entire repo (minus skip patterns), writes:
#   $OUT_DIR/manifest.json    — every kept file with size + path
#   $OUT_DIR/analysis.json    — prompt-ready bundle (app_name, framework,
#                               brand_colors, screens, source_context, …)
#   $FILES_DIR/<encoded-path> — raw file contents (truncated per file)
#
# Claude reads BOTH manifest.json (for full-repo understanding) and analysis.json
# (for the structured fields the PROMPT.md placeholders expect).
set -euo pipefail

TARGET_DIR="${1:-}"
OUT_DIR="${OUT_DIR:-./scratch/skill-output}"
FILES_DIR="${FILES_DIR:-./scratch/skill-files}"
MAX_FILE_BYTES="${MAX_FILE_BYTES:-8000}"
MAX_TOTAL_FILES="${MAX_TOTAL_FILES:-200}"
MAX_SOURCE_CONTEXT_BYTES="${MAX_SOURCE_CONTEXT_BYTES:-40000}"

if [ -z "$TARGET_DIR" ]; then
  echo "usage: analyze-local.sh <target-directory>" >&2
  echo "       (the directory whose code Claude should analyze for the mockup briefs)" >&2
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "error: $TARGET_DIR is not a directory" >&2
  exit 1
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
mkdir -p "$OUT_DIR" "$FILES_DIR"
rm -f "$FILES_DIR"/* 2>/dev/null || true

echo "[analyze-local] scanning $TARGET_DIR"

# --- Step 1: walk the repo, collect every file, apply skip patterns ---
python3 - "$TARGET_DIR" "$OUT_DIR" "$FILES_DIR" "$MAX_FILE_BYTES" "$MAX_TOTAL_FILES" "$MAX_SOURCE_CONTEXT_BYTES" <<'PYEOF'
import json, os, re, sys

target_dir, out_dir, files_dir, max_file_bytes, max_total_files, max_src_ctx = sys.argv[1:]
max_file_bytes = int(max_file_bytes)
max_total_files = int(max_total_files)
max_src_ctx = int(max_src_ctx)

# Directories to skip entirely (match anywhere in path)
skip_dirs = re.compile(
    r"(^|/)("
    r"node_modules|\.git|\.next|\.turbo|dist|build|out|target|vendor|"
    r"venv|\.venv|__pycache__|\.pytest_cache|\.mypy_cache|"
    r"ios/Pods|ios/build|android/build|android/\.gradle|android/app/build|"
    r"coverage|\.nyc_output|\.cache|tmp|"
    r"DerivedData|\.expo|\.expo-shared|"
    r"Headers|Pods\.xcodeproj|Pods-.+|RCT-.+\.framework|"
    r"\.xcworkspace|\.xcodeproj"
    r")(/|$)"
)

# File patterns to skip (binaries, locks, generated)
skip_files = re.compile(
    r"\.(png|jpe?g|gif|svg|ico|webp|bmp|tiff|"
    r"ttf|otf|woff2?|eot|"
    r"mp3|mp4|mov|webm|wav|m4a|"
    r"zip|tar|gz|tgz|rar|7z|"
    r"map|min\.js|min\.css|"
    r"lock|"
    r"pdf|xls[xm]?|doc[xm]?|ppt[xm]?|"
    r"keystore|jks|p12|"
    r"dat|bin|exe|dll|so|dylib"
    r")$|"
    r"^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|"
    r"Gemfile\.lock|Podfile\.lock|composer\.lock|poetry\.lock|"
    r"Cargo\.lock|go\.sum)$|"
    r"^\.DS_Store$",
    re.I,
)

def is_text(path, sample_bytes):
    if b"\0" in sample_bytes:
        return False
    try:
        sample_bytes.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False

manifest = []
file_contents = {}
total_bytes = 0

for root, dirs, files in os.walk(target_dir, followlinks=False):
    rel_root = os.path.relpath(root, target_dir)
    rel_root_norm = "" if rel_root == "." else rel_root.replace("\\", "/")
    if rel_root_norm and skip_dirs.search("/" + rel_root_norm + "/"):
        dirs[:] = []
        continue
    # Filter dirs in-place to prevent descent into skipped subdirs
    dirs[:] = [d for d in dirs if not skip_dirs.search(f"/{rel_root_norm}/{d}/" if rel_root_norm else f"/{d}/")]

    for fname in files:
        if skip_files.search(fname):
            continue
        full = os.path.join(root, fname)
        rel = os.path.relpath(full, target_dir).replace("\\", "/")

        try:
            size = os.path.getsize(full)
        except OSError:
            continue
        if size > 5 * 1024 * 1024:  # skip files >5 MB outright
            continue

        try:
            with open(full, "rb") as f:
                head = f.read(min(size, 4096))
        except OSError:
            continue
        if not is_text(rel, head):
            continue

        manifest.append({"path": rel, "size": size})

        if len(file_contents) < max_total_files:
            try:
                with open(full, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read(max_file_bytes)
                file_contents[rel] = content
                total_bytes += len(content)
            except OSError:
                pass

print(f"[analyze-local] found {len(manifest)} text files ({total_bytes} bytes captured from {len(file_contents)})", file=sys.stderr)

# Write manifest
with open(os.path.join(out_dir, "manifest.json"), "w") as f:
    json.dump({
        "target_dir": target_dir,
        "file_count": len(manifest),
        "files": manifest,
    }, f, indent=2)

# Persist captured file contents (so Claude can re-read individual files if needed)
for rel, content in file_contents.items():
    safe = rel.replace("/", "_")
    with open(os.path.join(files_dir, safe), "w", encoding="utf-8") as f:
        f.write(content)

# --- Build analysis.json (prompt-ready) ---

# Detect framework from file structure
all_paths = [m["path"] for m in manifest]
joined = "\n".join(all_paths)

def detect_framework(paths_blob):
    # JS-first detection — package.json deps are the most reliable signal
    pkg = file_contents.get("package.json", "")
    if pkg:
        try:
            p = json.loads(pkg)
            deps = {**(p.get("dependencies") or {}), **(p.get("devDependencies") or {})}
            if "react-native" in deps or "expo" in deps:
                return "react-native"
            if "next" in deps:
                return "web"
            if any(k in deps for k in ("vite", "react", "vue", "svelte", "@angular/core")):
                return "web"
        except Exception:
            pass
    # Native-only fallbacks
    if re.search(r"^pubspec\.yaml$", paths_blob, re.M): return "flutter"
    if re.search(r"AndroidManifest\.xml", paths_blob) and re.search(r"build\.gradle", paths_blob):
        if re.search(r"\.kt$|\.java$", paths_blob, re.M):
            return "android-native"
    if re.search(r"Info\.plist", paths_blob) and re.search(r"\.swift$", paths_blob, re.M):
        return "ios-native"
    if re.search(r"^next\.config\.", paths_blob, re.M): return "web"
    if "package.json" in file_contents: return "web"
    return "unknown"

framework = detect_framework(joined)

# App name — from package.json, app.json, pubspec.yaml, or directory name
app_name = ""
for cfg in ("app.json", "package.json", "expo.json"):
    if cfg in file_contents:
        try:
            p = json.loads(file_contents[cfg])
            app_name = (
                (p.get("expo", {}) or {}).get("name")
                or p.get("displayName")
                or p.get("name")
                or ""
            )
            if app_name:
                break
        except Exception:
            pass
if not app_name and "pubspec.yaml" in file_contents:
    m = re.search(r"^name:\s*(.+)", file_contents["pubspec.yaml"], re.M)
    if m: app_name = m.group(1).strip()
if not app_name:
    app_name = os.path.basename(target_dir)
app_name = re.sub(r"[-_]", " ", app_name).strip().title()

# Description from config
description = ""
for cfg in ("package.json", "app.json", "expo.json"):
    if cfg in file_contents:
        try:
            p = json.loads(file_contents[cfg])
            description = (
                p.get("description")
                or (p.get("expo", {}) or {}).get("description")
                or ""
            )
            if description:
                break
        except Exception:
            pass
if not description and "pubspec.yaml" in file_contents:
    m = re.search(r"^description:\s*(.+)", file_contents["pubspec.yaml"], re.M)
    if m: description = m.group(1).strip()

# README — case-insensitive
readme = ""
for k, v in file_contents.items():
    if re.match(r"^README(\.[a-z]+)?$", k, re.I) or re.match(r"^readme(\.[a-z]+)?$", k, re.I):
        readme = v
        break

# Brand colors — scan theme/style/tailwind/globals
hex_re = re.compile(r"#[0-9a-fA-F]{6}\b")
brand = []
for p, c in file_contents.items():
    if re.search(r"theme|color|tailwind|style|globals\.css|palette", p, re.I):
        brand.extend(hex_re.findall(c))
brand = list(dict.fromkeys(brand))[:12]

# Screens — only true source files, NOT build artifacts.
# Limit to .dart/.tsx/.ts/.jsx/.js/.kt/.java/.swift extensions only.
screens = []
seen_screens = set()
src_ext_re = re.compile(r"\.(dart|tsx|ts|jsx|js|kt|java|swift)$", re.I)
screen_path_re = re.compile(r"(screen|page|view|activity|fragment)", re.I)
for p in all_paths:
    if not src_ext_re.search(p):
        continue
    if not screen_path_re.search(p):
        continue
    # Skip stories/tests
    if re.search(r"\.(test|spec|stories)\.", p, re.I):
        continue
    name = os.path.basename(p)
    name = src_ext_re.sub("", name)
    # Strip common suffixes like "Screen", "Page" before title-casing
    pretty = re.sub(r"(Screen|Page|View|Activity|Fragment)$", "", name)
    pretty = re.sub(r"([a-z])([A-Z])", r"\1 \2", pretty)  # camelCase -> spaces
    pretty = re.sub(r"[-_]", " ", pretty).strip().title()
    if len(pretty) > 1 and pretty not in seen_screens:
        screens.append(pretty)
        seen_screens.add(pretty)
    if len(screens) >= 30:
        break

# Topics — keywords from package.json + directory hint
topics = []
if "package.json" in file_contents:
    try:
        p = json.loads(file_contents["package.json"])
        kw = p.get("keywords") or []
        if isinstance(kw, list):
            topics.extend([str(k) for k in kw])
    except Exception:
        pass
topics = list(dict.fromkeys(topics))[:12]

# Source context — concatenate captured files (skip README — already in readme_full)
src_parts = []
budget = max_src_ctx
# Prioritize informative files first
def src_priority(rel):
    base = os.path.basename(rel).lower()
    if base in ("package.json", "app.json", "expo.json", "pubspec.yaml", "go.mod", "cargo.toml", "pyproject.toml"): return 0
    if re.match(r"^app\.(tsx?|jsx?)$", base): return 1
    if re.search(r"(screen|page)", rel, re.I): return 2
    if re.match(r"^src/", rel) or re.match(r"^lib/", rel) or re.match(r"^app/", rel): return 3
    if re.match(r"^(tailwind|next|vite)\.config\.", base): return 4
    return 5

ordered = sorted(
    [(p, c) for p, c in file_contents.items() if not re.match(r"^README", p, re.I) and not re.match(r"^readme", p, re.I)],
    key=lambda kv: (src_priority(kv[0]), len(kv[1])),
)
for p, c in ordered:
    chunk = f"\n--- FILE: {p} ---\n{c}\n"
    if len(chunk) > budget:
        chunk = chunk[:budget]
    src_parts.append(chunk)
    budget -= len(chunk)
    if budget <= 0:
        break
source_context = "".join(src_parts)

# App icon — search for icon files we kept in manifest
app_icon_path = ""
icon_patterns = [
    r".*mipmap-xxxhdpi/ic_launcher\.png$",
    r".*mipmap-xxhdpi/ic_launcher\.png$",
    r"web/icons/Icon-192\.png$",
    r"public/logo\d*\.(png|svg)$",
    r"public/icon\d*\.(png|svg)$",
    r"public/favicon\.(png|ico|svg)$",
    r"assets?/.*logo.*\.(png|svg)$",
    r"assets?/.*icon.*\.(png|svg)$",
    r".*AppIcon.*\.png$",
]
# (binaries were filtered out of manifest, so re-scan target_dir for icon paths only)
icon_found = ""
for root, dirs, files in os.walk(target_dir, followlinks=False):
    rel_root = os.path.relpath(root, target_dir).replace("\\", "/")
    if rel_root != "." and skip_dirs.search("/" + rel_root + "/"):
        dirs[:] = []
        continue
    dirs[:] = [d for d in dirs if not skip_dirs.search(f"/{rel_root}/{d}/" if rel_root != '.' else f"/{d}/")]
    for fname in files:
        rel = os.path.relpath(os.path.join(root, fname), target_dir).replace("\\", "/")
        for pat in icon_patterns:
            if re.search(pat, rel, re.I):
                icon_found = rel
                break
        if icon_found:
            break
    if icon_found:
        break

analysis = {
    "app_name": app_name,
    "framework": framework,
    "description": description,
    "language": "",
    "stars": 0,
    "topics": topics,
    "brand_colors": brand,
    "screens": screens,
    "readme_full": readme[:8000],
    "source_context": source_context,
    "pkg_description": description,
    "key_files": list(file_contents.keys())[:30],
    "file_count": len(manifest),
    "app_icon_url": app_icon_path or "",
    "app_icon_local": icon_found,
    "target_dir": target_dir,
    "features": [],
}

with open(os.path.join(out_dir, "analysis.json"), "w") as f:
    json.dump(analysis, f, indent=2)

print(f"[analyze-local] wrote analysis.json (app_name={app_name!r}, framework={framework}, files={len(manifest)}, screens={len(screens)})", file=sys.stderr)
PYEOF

echo "[analyze-local] outputs in $OUT_DIR/"
echo "[analyze-local] manifest:    $OUT_DIR/manifest.json"
echo "[analyze-local] analysis:    $OUT_DIR/analysis.json"
echo "[analyze-local] file dump:   $FILES_DIR/"
