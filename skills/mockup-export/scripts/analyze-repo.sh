#!/usr/bin/env bash
# analyze-repo.sh — fetch GitHub repo metadata + key file contents into $OUT_DIR/skill-files/
# Cascade: gh CLI -> curl with $GITHUB_TOKEN -> unauthenticated curl
# Public file contents always come from raw.githubusercontent.com (no rate limit).
set -euo pipefail

URL="${1:-}"
OUT_DIR="${OUT_DIR:-./scratch/skill-output}"
FILES_DIR="${FILES_DIR:-./scratch/skill-files}"

if [ -z "$URL" ]; then
  echo "usage: analyze-repo.sh <github-url>" >&2
  exit 1
fi

mkdir -p "$OUT_DIR" "$FILES_DIR"
rm -f "$FILES_DIR"/*

OWNER_REPO=$(echo "$URL" | sed -E 's|https?://github\.com/([^/]+/[^/]+).*|\1|; s|\.git$||')
if [ "$OWNER_REPO" = "$URL" ]; then
  echo "error: could not parse owner/repo from $URL" >&2
  exit 1
fi
OWNER="${OWNER_REPO%/*}"
REPO="${OWNER_REPO#*/}"

# --- Detect auth mode ---
gh_call() {
  local path="$1"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    gh api "$path"
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    curl -sL \
      -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/$path"
  else
    curl -sL \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/$path"
  fi
}

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "[analyze] auth: gh CLI"
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "[analyze] auth: \$GITHUB_TOKEN"
else
  echo "[analyze] auth: unauthenticated (60 req/hr — file contents via raw.githubusercontent.com unlimited)"
fi

# --- Step 1: repo info ---
echo "[analyze] fetching repo info for $OWNER_REPO"
gh_call "repos/$OWNER_REPO" > "$OUT_DIR/repo_info.json"

if grep -q '"message".*"Not Found"' "$OUT_DIR/repo_info.json"; then
  echo "error: repo $OWNER_REPO not found (or private without auth)" >&2
  exit 1
fi
if grep -q '"message".*"rate limit"' "$OUT_DIR/repo_info.json" 2>/dev/null; then
  echo "error: GitHub API rate limit exceeded" >&2
  cat "$OUT_DIR/repo_info.json" >&2
  exit 1
fi

BRANCH=$(python3 -c "import json,sys; print(json.load(open('$OUT_DIR/repo_info.json')).get('default_branch','main'))")
echo "[analyze] default branch: $BRANCH"

# --- Step 2: file tree ---
echo "[analyze] fetching file tree"
gh_call "repos/$OWNER_REPO/git/trees/$BRANCH?recursive=1" > "$OUT_DIR/tree.json"

# --- Step 3: rank and select files ---
# Tier A: always include if present
# Tier B: entry points
# Tier C: config/CI
# Tier D: shallowest source files
python3 - <<PYEOF > "$OUT_DIR/selected_files.txt"
import json, re

with open("$OUT_DIR/tree.json") as f:
    tree = json.load(f)

paths = [item["path"] for item in tree.get("tree", []) if item.get("type") == "blob"]

skip_re = re.compile(r"node_modules/|dist/|build/|\.next/|target/|vendor/|\.lock$|\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.ico$|\.ttf$|\.woff$|\.woff2$|\.map$|test/|tests/|__tests__/|spec/|fixtures/|\.min\.", re.I)
paths = [p for p in paths if not skip_re.search(p)]

tier_a = [
    r"^README(\..*)?$",
    r"^package\.json$",
    r"^pyproject\.toml$",
    r"^requirements.*\.txt$",
    r"^Cargo\.toml$",
    r"^go\.mod$",
    r"^tsconfig\.json$",
    r"^next\.config\.(ts|js|mjs|cjs)$",
    r"^vite\.config\.(ts|js|mjs)$",
    r"^Dockerfile$",
    r"^docker-compose\.ya?ml$",
    r"^pubspec\.yaml$",
    r"^app\.json$",
    r"^expo\.json$",
]
tier_b = [
    r"^src/index\.(tsx?|jsx?)$",
    r"^src/main\.(tsx?|jsx?|py|go)$",
    r"^src/App\.(tsx?|jsx?)$",
    r"^app/page\.tsx$",
    r"^app/layout\.tsx$",
    r"^src/app/page\.tsx$",
    r"^main\.py$",
    r"^__main__\.py$",
    r"^cmd/.+/main\.go$",
    r"^lib/main\.dart$",
]
tier_c = [
    r"^\.github/workflows/.+\.ya?ml$",
    r"^prisma/schema\.prisma$",
    r"^tailwind\.config\.(ts|js|mjs|cjs)$",
]

def first_match(patterns):
    out = []
    for pat in patterns:
        rx = re.compile(pat, re.I)
        for p in paths:
            if rx.search(p) and p not in out:
                out.append(p)
                break
    return out

selected = []
for path in first_match(tier_a) + first_match(tier_b) + first_match(tier_c):
    if path not in selected:
        selected.append(path)

# Tier D: shallowest source files, language priority
src_priority = {".ts": 1, ".tsx": 1, ".py": 2, ".go": 3, ".rs": 4, ".dart": 5, ".js": 6, ".jsx": 6, ".kt": 7, ".java": 8, ".swift": 9}
screen_re = re.compile(r"(screen|page|view|activity|fragment)", re.I)
candidates = []
for p in paths:
    if p in selected:
        continue
    ext = "." + p.rsplit(".", 1)[-1] if "." in p else ""
    if ext not in src_priority:
        continue
    depth = p.count("/")
    score = src_priority[ext] * 100 + depth - (10 if screen_re.search(p) else 0)
    candidates.append((score, p))
candidates.sort()
for _, p in candidates:
    if len(selected) >= 15:
        break
    selected.append(p)

for p in selected:
    print(p)
PYEOF

NUM_FILES=$(wc -l < "$OUT_DIR/selected_files.txt" | tr -d ' ')
echo "[analyze] selected $NUM_FILES files for content fetch"

# --- Step 4: fetch file contents via raw.githubusercontent.com (unlimited) ---
while IFS= read -r path; do
  [ -z "$path" ] && continue
  safe=$(echo "$path" | tr '/' '_')
  if curl -sL --max-time 15 \
    "https://raw.githubusercontent.com/$OWNER_REPO/$BRANCH/$path" \
    -o "$FILES_DIR/$safe"; then
    size=$(wc -c < "$FILES_DIR/$safe" | tr -d ' ')
    echo "[analyze]   $path  ($size bytes)"
    # Truncate to 5000 chars per file to keep prompt budget reasonable
    if [ "$size" -gt 5000 ]; then
      head -c 5000 "$FILES_DIR/$safe" > "$FILES_DIR/$safe.tmp"
      mv "$FILES_DIR/$safe.tmp" "$FILES_DIR/$safe"
    fi
  fi
done < "$OUT_DIR/selected_files.txt"

# --- Step 5: build analysis.json (lightweight, prompt-ready bundle) ---
python3 - <<PYEOF
import json, os, re

repo_info = json.load(open("$OUT_DIR/repo_info.json"))
with open("$OUT_DIR/selected_files.txt") as f:
    selected = [l.strip() for l in f if l.strip()]

files_dir = "$FILES_DIR"
contents = {}
for p in selected:
    safe = p.replace("/", "_")
    fp = os.path.join(files_dir, safe)
    if os.path.exists(fp):
        try:
            with open(fp, "r", errors="replace") as f:
                contents[p] = f.read()
        except Exception:
            pass

with open("$OUT_DIR/tree.json") as f:
    tree = json.load(f)
all_files = [item["path"] for item in tree.get("tree", []) if item.get("type") == "blob"]

# detect framework
def detect_framework(paths):
    joined = "\n".join(paths)
    if re.search(r"pubspec\.yaml", joined): return "flutter"
    if re.search(r"build\.gradle", joined) and re.search(r"AndroidManifest\.xml", joined): return "android-native"
    if re.search(r"Info\.plist", joined) and re.search(r"\.swift$", joined, re.M): return "ios-native"
    if re.search(r"package\.json", joined) and re.search(r"react-native", joined, re.I): return "react-native"
    if re.search(r"next\.config", joined): return "web"
    if re.search(r"package\.json", joined): return "web"
    return "unknown"

framework = detect_framework(all_files)

# extract brand colors from theme/style files
hex_re = re.compile(r"#[0-9a-fA-F]{6}\b")
brand = []
for p, c in contents.items():
    if re.search(r"theme|color|tailwind|style|globals\.css", p, re.I):
        brand.extend(hex_re.findall(c))
brand = list(dict.fromkeys(brand))[:8]

# screens from path heuristic
screens = []
for f in all_files:
    if re.search(r"screen|page|view|activity|fragment", f, re.I):
        name = f.rsplit("/", 1)[-1]
        name = re.sub(r"\.(dart|tsx?|jsx?|kt|java|swift)$", "", name, flags=re.I)
        name = re.sub(r"[-_]", " ", name).title()
        if len(name) > 2 and name not in screens:
            screens.append(name)
        if len(screens) >= 20:
            break

# package description
pkg_desc = ""
for cfg in ["package.json", "app.json", "expo.json"]:
    if cfg in contents:
        try:
            pkg = json.loads(contents[cfg])
            pkg_desc = pkg.get("description", "") or (pkg.get("expo", {}) or {}).get("description", "") or ""
            if pkg_desc: break
        except Exception:
            pass

# README — case-insensitive lookup since GitHub allows readme.md / README.md / Readme.rst etc.
readme = ""
for k, v in contents.items():
    if re.match(r"^README(\..*)?$", k, re.I) or re.match(r"^readme(\..*)?$", k, re.I):
        readme = v
        break
readme = readme[:5000]

source_context_parts = []
for p, c in contents.items():
    if p in ("README.md", "README.rst"): continue
    source_context_parts.append(f"\n--- FILE: {p} ---\n{c}\n")
source_context = "".join(source_context_parts)[:20000]

app_name = re.sub(r"[-_]", " ", repo_info["name"]).title()

analysis = {
    "app_name": app_name,
    "framework": framework,
    "description": repo_info.get("description", "") or pkg_desc,
    "language": repo_info.get("language", ""),
    "stars": repo_info.get("stargazers_count", 0),
    "topics": repo_info.get("topics", []),
    "brand_colors": brand,
    "screens": screens,
    "readme_full": readme,
    "source_context": source_context,
    "pkg_description": pkg_desc,
    "key_files": list(contents.keys()),
    "file_count": len(all_files),
    "app_icon_url": f"https://github.com/{repo_info['owner']['login']}.png?size=200",
    "features": [],  # synthesized by Claude during brief generation
}

with open("$OUT_DIR/analysis.json", "w") as f:
    json.dump(analysis, f, indent=2)

print(f"[analyze] wrote analysis.json (app_name={app_name}, framework={framework}, files={len(contents)})")
PYEOF

echo "[analyze] done. outputs in $OUT_DIR/"
