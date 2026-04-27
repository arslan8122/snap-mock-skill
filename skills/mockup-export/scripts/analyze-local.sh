#!/usr/bin/env bash
# analyze-local.sh — scan a local directory for mockup-brief synthesis.
# Walks the entire repo (minus skip patterns), writes:
#   $OUT_DIR/manifest.json    — every kept file with size + path
#   $OUT_DIR/analysis.json    — prompt-ready bundle (app_name, framework,
#                               brand_colors, screens, source_context, …)
#   $FILES_DIR/<encoded-path> — raw file contents (truncated per file)
#
# Strategy: walk the entire tree and build a manifest first (cheap), then
# load files in *priority order* (theme/colors -> screens -> entry points ->
# config -> rest) so the small capture budget always sees the most useful
# files first.
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

python3 - "$TARGET_DIR" "$OUT_DIR" "$FILES_DIR" "$MAX_FILE_BYTES" "$MAX_TOTAL_FILES" "$MAX_SOURCE_CONTEXT_BYTES" <<'PYEOF'
import base64, json, os, re, sys

target_dir, out_dir, files_dir, max_file_bytes, max_total_files, max_src_ctx = sys.argv[1:]
max_file_bytes = int(max_file_bytes)
max_total_files = int(max_total_files)
max_src_ctx = int(max_src_ctx)

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
skip_files_text = re.compile(
    r"\.(map|min\.js|min\.css|"
    r"zip|tar|gz|tgz|rar|7z|"
    r"mp3|mp4|mov|webm|wav|m4a|"
    r"pdf|xls[xm]?|doc[xm]?|ppt[xm]?|"
    r"keystore|jks|p12|"
    r"dat|bin|exe|dll|so|dylib|"
    r"ttf|otf|woff2?|eot)$|"
    r"^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|"
    r"Gemfile\.lock|Podfile\.lock|composer\.lock|poetry\.lock|"
    r"Cargo\.lock|go\.sum)$|"
    r"^\.DS_Store$",
    re.I,
)
binary_image_ext = re.compile(r"\.(png|jpe?g|gif|svg|webp|bmp|tiff|ico)$", re.I)

def is_text(sample_bytes):
    if b"\0" in sample_bytes:
        return False
    try:
        sample_bytes.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False

# Pass 1: walk tree -> manifest of all text files + image-asset paths
manifest = []
image_paths = []  # for app-icon discovery later

for root, dirs, files in os.walk(target_dir, followlinks=False):
    rel_root = os.path.relpath(root, target_dir).replace("\\", "/")
    if rel_root != "." and skip_dirs.search("/" + rel_root + "/"):
        dirs[:] = []
        continue
    dirs[:] = [d for d in dirs if not skip_dirs.search(f"/{rel_root}/{d}/" if rel_root != '.' else f"/{d}/")]
    for fname in files:
        rel = os.path.relpath(os.path.join(root, fname), target_dir).replace("\\", "/")

        # Track image assets even though we won't read them as text
        if binary_image_ext.search(fname):
            image_paths.append(rel)
            continue

        if skip_files_text.search(fname):
            continue
        full = os.path.join(root, fname)
        try:
            size = os.path.getsize(full)
        except OSError:
            continue
        if size > 5 * 1024 * 1024:
            continue
        try:
            with open(full, "rb") as f:
                head = f.read(min(size, 4096))
        except OSError:
            continue
        if not is_text(head):
            continue
        manifest.append({"path": rel, "size": size})

print(f"[analyze-local] manifest: {len(manifest)} text files, {len(image_paths)} image assets", file=sys.stderr)

# Priority scoring — lower score loads first
def priority(path):
    p = path
    base = os.path.basename(p).lower()
    # Tier 0: theme / brand-color sources (CRITICAL for color extraction)
    if re.search(r"(theme|colors?|palette|tokens|design)\.(ts|tsx|js|jsx|json)$", p, re.I): return 0
    if re.search(r"(theme|colors?|palette|tokens|design)/.*\.(ts|tsx|js|jsx)$", p, re.I): return 0
    if re.search(r"globals?\.css$|tailwind\.config\.", p, re.I): return 0
    # Tier 1: top-level config that names the app
    if base in ("app.json", "expo.json", "package.json", "pubspec.yaml"): return 1
    # Tier 2: README at the root
    if re.match(r"^README(\.[a-z]+)?$", p, re.I) or re.match(r"^readme(\.[a-z]+)?$", p, re.I): return 2
    # Tier 3: screens (the actual UI)
    if re.search(r"(screens?|pages?|views?|activities|fragments)/", p, re.I) and re.search(r"\.(tsx?|jsx?|dart|kt|java|swift)$", p, re.I): return 3
    # Tier 4: entry points
    if re.match(r"^(src/)?App\.(tsx?|jsx?)$", p): return 4
    if re.match(r"^(src/)?(index|main)\.(tsx?|jsx?|py|dart|go)$", p): return 4
    if re.match(r"^app/.*page\.(tsx?|jsx?)$", p): return 4
    if re.match(r"^src/app/.*page\.(tsx?|jsx?)$", p): return 4
    # Tier 5: components
    if re.search(r"components?/", p, re.I) and re.search(r"\.(tsx?|jsx?|dart)$", p, re.I): return 5
    # Tier 6: feature docs
    if re.search(r"FEATURES?|CAPABILITIES|README", base.upper()): return 6
    # Tier 7: TS/JS/Dart/Swift source elsewhere
    if re.search(r"\.(tsx?|jsx?|dart|kt|java|swift|py|go|rs)$", p, re.I): return 7
    # Tier 8: configs
    if re.search(r"\.config\.(ts|tsx|js|jsx|mjs|cjs)$", p, re.I): return 8
    return 9

manifest.sort(key=lambda m: (priority(m["path"]), m["path"]))

# Pass 2: load files in priority order
file_contents = {}
total_bytes = 0
for entry in manifest:
    if len(file_contents) >= max_total_files:
        break
    rel = entry["path"]
    full = os.path.join(target_dir, rel)
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(max_file_bytes)
        file_contents[rel] = content
        total_bytes += len(content)
    except OSError:
        continue

print(f"[analyze-local] captured {len(file_contents)} files, {total_bytes} bytes", file=sys.stderr)

# Persist manifest + file dump
with open(os.path.join(out_dir, "manifest.json"), "w") as f:
    json.dump({"target_dir": target_dir, "file_count": len(manifest), "files": manifest}, f, indent=2)
for rel, content in file_contents.items():
    safe = rel.replace("/", "_")
    with open(os.path.join(files_dir, safe), "w", encoding="utf-8") as f:
        f.write(content)

# ---- Build analysis.json ----
all_paths = [m["path"] for m in manifest]
joined = "\n".join(all_paths)

# Framework — JS-first
def detect_framework():
    pkg = file_contents.get("package.json", "")
    if pkg:
        try:
            p = json.loads(pkg)
            deps = {**(p.get("dependencies") or {}), **(p.get("devDependencies") or {})}
            if "react-native" in deps or "expo" in deps: return "react-native"
            if "next" in deps: return "web"
            if any(k in deps for k in ("vite", "react", "vue", "svelte", "@angular/core")): return "web"
        except Exception:
            pass
    if re.search(r"^pubspec\.yaml$", joined, re.M): return "flutter"
    if re.search(r"AndroidManifest\.xml", joined) and re.search(r"build\.gradle", joined):
        if re.search(r"\.kt$|\.java$", joined, re.M): return "android-native"
    if re.search(r"Info\.plist", joined) and re.search(r"\.swift$", joined, re.M): return "ios-native"
    if re.search(r"^next\.config\.", joined, re.M): return "web"
    if "package.json" in file_contents: return "web"
    return "unknown"

framework = detect_framework()

# App name
app_name = ""
for cfg in ("app.json", "package.json", "expo.json"):
    if cfg in file_contents:
        try:
            p = json.loads(file_contents[cfg])
            app_name = (p.get("expo", {}) or {}).get("name") or p.get("displayName") or p.get("name") or ""
            if app_name: break
        except Exception:
            pass
if not app_name and "pubspec.yaml" in file_contents:
    m = re.search(r"^name:\s*(.+)", file_contents["pubspec.yaml"], re.M)
    if m: app_name = m.group(1).strip()
if not app_name:
    app_name = os.path.basename(target_dir)
app_name = re.sub(r"[-_]", " ", app_name).strip().title()

# Description
description = ""
for cfg in ("package.json", "app.json", "expo.json"):
    if cfg in file_contents:
        try:
            p = json.loads(file_contents[cfg])
            description = p.get("description") or (p.get("expo", {}) or {}).get("description") or ""
            if description: break
        except Exception:
            pass
if not description and "pubspec.yaml" in file_contents:
    m = re.search(r"^description:\s*(.+)", file_contents["pubspec.yaml"], re.M)
    if m: description = m.group(1).strip()

# README
readme = ""
for k, v in file_contents.items():
    if re.match(r"^README(\.[a-z]+)?$", k, re.I) or re.match(r"^readme(\.[a-z]+)?$", k, re.I):
        readme = v
        break

# Brand colors — expanded extraction
# 1. #RRGGBB / #RGB hex literals
# 2. rgb()/rgba() literals -> convert
# 3. Look in theme/color/palette files first, then everywhere
hex6_re = re.compile(r"#([0-9a-fA-F]{6})\b")
hex3_re = re.compile(r"#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])")
rgb_re = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")

# Common boring colors to deprioritize (white/black/grey)
boring = {"#ffffff", "#fefefe", "#000000", "#111111", "#222222", "#f5f5f5", "#fafafa"}

def normalize(c):
    return c.lower()

def extract_colors_from(text):
    out = []
    for m in hex6_re.finditer(text):
        c = "#" + m.group(1).lower()
        if c not in boring:
            out.append(c)
    for m in hex3_re.finditer(text):
        h = m.group(1).lower()
        c = "#" + h[0]*2 + h[1]*2 + h[2]*2
        if c not in boring:
            out.append(c)
    for m in rgb_re.finditer(text):
        try:
            r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
            c = "#" + "".join(f"{v:02x}" for v in (r, g, b))
            if c not in boring:
                out.append(c)
        except Exception:
            pass
    return out

# Score colors: appearances in theme/colors files weigh 3x
brand_scores = {}
def add_color(c, weight):
    brand_scores[c] = brand_scores.get(c, 0) + weight

color_path_re = re.compile(r"(theme|colors?|palette|tokens|design)", re.I)
for p, c in file_contents.items():
    weight = 3 if color_path_re.search(p) else 1
    for col in extract_colors_from(c):
        add_color(col, weight)

# Sort by score desc, take top 8
brand = [c for c, _ in sorted(brand_scores.items(), key=lambda kv: -kv[1])[:8]]

# Screens — source files only
screens = []
seen = set()
src_ext = re.compile(r"\.(dart|tsx|ts|jsx|js|kt|java|swift)$", re.I)
screen_path_re = re.compile(r"(screen|page|view|activity|fragment)", re.I)
for p in all_paths:
    if not src_ext.search(p) or not screen_path_re.search(p):
        continue
    if re.search(r"\.(test|spec|stories)\.", p, re.I): continue
    name = os.path.basename(p)
    name = src_ext.sub("", name)
    pretty = re.sub(r"(Screen|Page|View|Activity|Fragment)$", "", name)
    pretty = re.sub(r"([a-z])([A-Z])", r"\1 \2", pretty)
    pretty = re.sub(r"[-_]", " ", pretty).strip().title()
    if len(pretty) > 1 and pretty not in seen:
        screens.append(pretty)
        seen.add(pretty)
    if len(screens) >= 30: break

# Topics
topics = []
if "package.json" in file_contents:
    try:
        p = json.loads(file_contents["package.json"])
        kw = p.get("keywords") or []
        if isinstance(kw, list): topics.extend([str(k) for k in kw])
    except Exception: pass
topics = list(dict.fromkeys(topics))[:12]

# Source context — already-prioritized file_contents, skip README (in readme_full)
src_parts = []
budget = max_src_ctx
for p, c in file_contents.items():
    if re.match(r"^README", p, re.I) or re.match(r"^readme", p, re.I):
        continue
    chunk = f"\n--- FILE: {p} ---\n{c}\n"
    if len(chunk) > budget:
        chunk = chunk[:budget]
    src_parts.append(chunk)
    budget -= len(chunk)
    if budget <= 0: break
source_context = "".join(src_parts)

# --- App icon: find local file, base64-embed as data URL ---
app_icon_local = ""
app_icon_data_url = ""

# Resolve icon path from app.json (Expo config)
app_icon_hint = ""
if "app.json" in file_contents:
    try:
        p = json.loads(file_contents["app.json"])
        # Expo nests under "expo.icon"; bare RN can have "icon" at top
        app_icon_hint = (p.get("expo", {}) or {}).get("icon") or p.get("icon") or ""
    except Exception: pass

icon_candidates = []
# 1. explicit hint from config (relative path)
if app_icon_hint:
    rel = app_icon_hint.lstrip("./")
    if rel in image_paths:
        icon_candidates.append(rel)
# 2. priority patterns
icon_patterns = [
    r".*mipmap-xxxhdpi/ic_launcher\.png$",
    r".*mipmap-xxhdpi/ic_launcher\.png$",
    r"^logo\.(png|jpe?g)$",
    r"^icon\.(png|jpe?g)$",
    r"web/icons/Icon-192\.png$",
    r"public/logo\d*\.(png|jpe?g)$",
    r"public/icon\d*\.(png|jpe?g)$",
    r"public/favicon\.(png|ico|jpe?g)$",
    r"assets?/.*logo.*\.(png|jpe?g)$",
    r"assets?/.*icon.*\.(png|jpe?g)$",
    r".*AppIcon.*1024.*\.png$",
    r".*AppIcon.*\.png$",
]
for pat in icon_patterns:
    rx = re.compile(pat, re.I)
    for img in image_paths:
        if rx.search(img) and img not in icon_candidates:
            icon_candidates.append(img)

# Read first existing candidate, base64-encode
for cand in icon_candidates:
    full = os.path.join(target_dir, cand)
    try:
        size = os.path.getsize(full)
    except OSError:
        continue
    if size > 2 * 1024 * 1024:  # cap icon at 2 MB to avoid bloating briefs.json
        continue
    try:
        with open(full, "rb") as f:
            data = f.read()
    except OSError:
        continue
    ext = cand.rsplit(".", 1)[-1].lower()
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    app_icon_data_url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
    app_icon_local = cand
    break

if app_icon_local:
    print(f"[analyze-local] embedded app icon: {app_icon_local} ({len(app_icon_data_url)} chars)", file=sys.stderr)
else:
    print(f"[analyze-local] no app icon found", file=sys.stderr)

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
    "app_icon_url": app_icon_data_url,  # data URL — directly usable as IconLayer.imageUrl
    "app_icon_local": app_icon_local,    # for debugging
    "target_dir": target_dir,
    "features": [],
}

with open(os.path.join(out_dir, "analysis.json"), "w") as f:
    json.dump(analysis, f, indent=2)

print(f"[analyze-local] wrote analysis.json (app_name={app_name!r}, framework={framework}, files={len(manifest)}, screens={len(screens)}, brand_colors={len(brand)})", file=sys.stderr)
PYEOF

echo "[analyze-local] outputs in $OUT_DIR/"
echo "[analyze-local] manifest:    $OUT_DIR/manifest.json"
echo "[analyze-local] analysis:    $OUT_DIR/analysis.json"
echo "[analyze-local] file dump:   $FILES_DIR/"
