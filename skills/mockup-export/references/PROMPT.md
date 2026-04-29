# Synthesis prompt — produce briefs.json from analysis.json

**Output ONLY a single JSON object matching the schema below. No preamble, no code fences, no commentary, no explanation. Just the JSON.**

You will run FOUR reasoning passes internally and combine them into one final JSON output. Do not show intermediate work — only the final JSON.

This prompt is **app-agnostic**. Everything specific to a real app — copy, colors, screen names, tab labels, list items — must come from `analysis.json` (and from re-reading source files on disk when needed). Never inject content from prior examples.

---

## PASS 0 — NARRATIVE ARC (do this BEFORE writing any copy)

The 6 slots are not 6 independent posters. They tell a story. Per 2026 Play Store research, optimized 6-slot sets drive ~24% conversion uplift. **Pick one of these arcs and assign each of your 6 screen_names to a slot role:**

**Arc A (recommended for utility / productivity / professional tools):**
1. **Hook** — biggest emotional headline. The outcome a pro buys. (e.g. an outcome word + a category word, all caps, 2-4 words)
2. **Problem in detail** — show the specific pain this kills, with a real feature screen
3. **Core feature** — the headline screen the user came for
4. **Breadth** — show range/variety (lists, categories, multiple tools)
5. **Proof / Social** — history, saved data, projects, exports — *evidence that pros use this*
6. **CTA / Trust** — pricing-free promise, offline capability, standards compliance, ratings — never a generic feature screen

**Arc B (AIDA — recommended for entertainment / lifestyle / consumer):**
1. Attention (a striking visual hook)
2. Interest (what's inside)
3. Desire-1 (feature)
4. Desire-2 (feature)
5. Action (call to use)
6. Confirmation (testimonials/reviews)

**Mandatory rule:** the FINAL slot must contain a trust/proof element. Pick the one that matches the app's actual value proposition (offline, standards-compliant, no-ads, free, accuracy-tested, "works in the field", privacy-first, count of users, etc.). Never use a plain feature screen as slot 6.

---

## INPUTS

You are given:

1. `analysis.json` — analysis bundle from a local project directory. Fields: `app_name`, `framework`, `description`, `topics`, `brand_colors`, `features`, `screens`, `readme_full`, `source_context`, `pkg_description`, `app_icon_url`, `project_assets`, `key_files`, `file_count`.

   `project_assets` is an array of in-project images (illustrations, splash, hero, logo, onboarding, etc.) the synthesizer MAY composite into backgrounds or accent slots. Each entry has `{path, kind, ext, size, width, height, data_url}`. **You may use these images. You may NOT invent imagery, fetch external photos, or generate new visuals.** If `project_assets` is empty (or has only `kind: "other"`), every slot must be solid color + texture only — no imagery beyond the app icon and the in-device screen render.
2. `manifest.json` — full file index. Read individual source files directly when `source_context` is insufficient.
3. The output of this prompt is a `briefs.json` file consumed by the Konva-based renderer in the user's Next.js app.

### React Native variant detection (if framework is `react-native`)

Before writing copy, scan `key_files` and `source_context` to figure out which RN flavor you're in — it changes which files hold the truth:

- **Expo managed**: `app.json` / `app.config.js` / `app.config.ts` carries `expo.name`, `expo.icon`, `expo.primaryColor`, splash. Routes typically in `app/` (expo-router) or `src/screens/`.
- **Bare RN**: `index.js` registers root, `App.tsx` is the root, screens in `src/screens/` or `src/screens/<feature>/`. Tabs typically in `App.tsx` via `@react-navigation/bottom-tabs`.
- **expo-router**: tabs declared in `app/(tabs)/_layout.tsx` — read it to get REAL tab labels and order.
- **react-navigation**: tabs declared in a `Tab.Navigator` block — read for `Tab.Screen name="..."` entries to get REAL tab labels.
- **NativeWind / tailwind-rn**: theme colors live in `tailwind.config.js`. Treat its `theme.extend.colors` as primary brand colors.
- **react-native-paper / NativeBase / Tamagui / restyle**: theme files (`theme.ts`, `paperTheme.ts`, `tamagui.config.ts`) are authoritative for brand colors and dark/light pairs.
- **Redux/Zustand stores**: scan store slices for entity names (e.g. "projects", "saves", "history") — these become real list items in proof screens.

The single most useful read for any RN app is the navigator file: it tells you the screen graph in execution order. Find it via manifest (search for `Navigator`, `_layout.tsx`, `NavigationContainer`) and Read it before drafting `screen_ui`.

---

## PASS 1 — CONTENT BRIEF

You are an ASO (App Store Optimization) copywriter AND a mobile UI designer. Your job is to write marketing headlines AND describe the EXACT app screens for device mockups — based ENTIRELY on the project's own source.

Use the analysis fields above to fill in:
- App Name: `app_name`
- Framework: `framework`
- Description: `description` (or `pkg_description` if empty)
- Topics: `topics`
- Brand Colors: `brand_colors`
- Features: derive from `readme_full` (look for `## Features`, bullet lists, "What it does", capabilities sections). If none found, derive from `description` + `source_context`.
- Screens / pages in code: `screens`
- README: `readme_full` (truncated to 2000 chars internally)
- Source code context: `source_context` (truncated to 12000 chars internally)

Create a content brief for **exactly 6 Google Play Store screenshots**.

For each screenshot, provide:
- `screen_name`: short descriptive name (e.g. "Hero", "Dashboard", "Settings")
- `headline`: **1 OR 2 LINES MAX. 2–5 words TOTAL across both lines. Each line ≤20 characters.** ALL CAPS. Use `\n` for the line break only when it improves rhythm — single-line headlines are encouraged when they read well. Examples: `"TRADE GRADE"`, `"STOP\nGUESSING"`, `"BUILD ANYTHING"`, `"CODE COMPLIANT"`.
- `subtitle`: MAX 35 CHARACTERS. Single line. Concrete benefit + proof point.
- `layout_type`: one of `"hero_icon"`, `"single_device"`, `"dual_device"`, `"device_top_crop"`, `"tilted_device"`
- `device_count`: 0, 1, or 2
- `screen_ui`: structured description of what the ACTUAL APP SCREEN looks like inside the device frame. This must mirror the REAL app UI based on the source code. Include:
  - `screen_title`: the title shown in the navigation bar (REAL screen name from the app)
  - `has_bottom_nav`: true if this screen has a tab bar at the bottom
  - `active_tab_index`: which tab is highlighted (0-4)
  - `elements`: 7-10 UI elements in order from top to bottom. Each has:
    - `element_type`: one of `"status_bar"`, `"nav_bar"`, `"tab_bar"`, `"list_item"`, `"card"`, `"button"`, `"input_field"`, `"text_block"`, `"hero_banner"`, `"toggle_row"`, `"avatar_row"`, `"stat_card"`, `"divider"`, `"bottom_nav"`, `"search_bar"`, `"chip_row"`, `"image_placeholder"`, `"floating_modal"`, `"bottom_sheet"`, `"floating_dock"`
    - `text`: PRIMARY text shown — use REAL text from the app (actual menu labels, feature names, button labels from the source code)
    - `secondary_text`: subtitle or description (`""` if none)
    - `icon`: a relevant emoji for non-bottom_nav elements (e.g. `"⚡"`, `"📐"`, `"⚙️"`), or `""`. **For `bottom_nav`, leave `icon` empty** — the renderer auto-maps tab labels to consistent SVG icons.
    - **Optional polish fields** (use selectively to make the screen feel like a real screenshot, not a flat mockup):
      - `selected: true` on ONE `list_item` per screen — renders an accent-colored selection ring + glow halo around it (matches Happn's green-bordered "Alameda Beach"). Pick the most narratively important row.
      - `active_index: <int>` on `chip_row` — which chip is the active pill. The active chip renders as a solid black/white pill (high contrast); others are plain text. Default 0.
      - `badge: { text, tone }` on `list_item` — small status pill at the right edge. `tone` is one of `"success"|"warning"|"danger"|"info"|"neutral"`. Examples: `{text: "30 DAYS LEFT", tone: "success"}`, `{text: "PRO", tone: "info"}`, `{text: "SAVED", tone: "success"}`, `{text: "EXPIRED", tone: "danger"}`. Use sparingly (≤1 per screen).
      - `prominence: "primary"|"secondary"` on `button` — primary = gradient fill + elevated shadow; secondary = card-style outline. Default primary.
      - `tile_color: "#RRGGBB"` on `list_item` — explicit color for the icon tile. If omitted, the renderer picks deterministically from a vivid 8-color palette based on the icon+text — matches Happn's colorful spot-icon tiles. Only override when the brand demands a specific tile color.
      - **`image_placeholder` with real project asset.** When `analysis.project_assets` contains an entry of `kind` in `{illustration, hero, splash, onboarding}`, you MAY reference it inside an `image_placeholder` element via `asset_url: "<the path field of that asset entry>"`. The runtime resolves the path against `briefs.projectAssets` and renders the real image with a soft caption gradient. Use ≤1 image_placeholder per screen and only when the project actually has the asset — never fabricate paths. Optional `asset_fit: "cover" | "contain"` (default cover). The `text` field, when present, becomes a caption rendered over the bottom of the image.
      - **Overlay element types** (use AT MOST ONE per screen, only when narratively earned):
        - `floating_modal` — a centered card overlaying the screen with a dimmed scrim. Use when the slot tells a "tap result" story (success confirmation, trial offer, achievement). Fields: `text` (modal title), `secondary_text` (body line), `icon` (header glyph), `modal_cta` (button label, e.g. "Save Calculation"), `modal_tone` ∈ `"default"|"celebrate"|"alert"`. Place this AFTER the regular elements — order in the array doesn't matter for floats, the renderer always layers them on top.
        - `bottom_sheet` — bottom-anchored rounded-top sheet with drag handle and rows. Use for selectors (region, unit, filter) — narratively "user just opened a picker." Fields: `text` (sheet title), `secondary_text` (subtitle), `rows` (array of `{ text, secondary_text, icon }` — typically 3–5 rows from the app's actual data).
        - `floating_dock` — a horizontal pill of 3–5 colored circular action buttons (Happn slot 4 style). Use ONLY for swipe/discovery proof slots where the app has a clear action toolbar. Fields: `text` is pipe-separated labels (e.g. `"Boost|Skip|Like|Star"`); the renderer auto-assigns vivid colors and renders the first letter or emoji of each label.
        Use overlays sparingly — at most 1 of the 6 slots for `floating_modal`, at most 1 for `bottom_sheet`, and `floating_dock` only for apps where it matches the actual UI (don't fake an action dock for utility apps that don't have one).

### CRITICAL RULES FOR `screen_ui`
- Read the SOURCE CODE and extract ACTUAL screen names, menu items, button labels, and navigation structure.
- Whatever the app's real screen names are — use THOSE EXACT names as `list_item` text, NOT generic placeholders like "Feature 1" or "Tool A".
- If the app has tabs/navigation — replicate the REAL tab names from the navigator file.
- The `screen_ui` must look like a REAL screenshot of THIS specific app, not a generic template.
- Use element types that match the actual UI: list of items → `list_item`s; form → `input_field`s; cards → `card`s; chart → `image_placeholder` with a descriptive label.
- When the proof slot needs evidence content (saves, history, projects), pull the REAL entity names from the source — never invent placeholder rows like "Item 1, Item 2, Item 3".

### Unified design `theme`
- `headline_font`: pick from `"Inter"`, `"Montserrat"`, `"Oswald"`, `"Space Grotesk"`, `"DM Sans"`, `"Poppins"`, `"Playfair Display"`, `"Raleway"`, `"Nunito"`, `"Manrope"`
- `body_font`: pick from `"Inter"`, `"Roboto"`, `"Open Sans"`, `"Lato"`, `"DM Sans"`, `"Manrope"`
- `headline_weight`: `"700"` or `"800"`
- `mood`: `"professional"`, `"energetic"`, `"dark"`, `"minimal"`, `"bold"`, `"premium"`
- `accent_color`: hex color for decorative elements
- `primary_gradient_start`, `primary_gradient_end`: hex colors derived from brand colors
- `mesh_colors`: exactly 3 hex colors for mesh gradients

#### Theme color picking (deterministic, drives all 6 slots)
- `primary_gradient_start` = `analysis.brand_colors[0]` (the project's most-frequent brand color).
- `primary_gradient_end` = `analysis.brand_colors[1]` if it exists and contrasts with [0]; otherwise darken [0] by ~25% lightness.
- `accent_color` = `analysis.brand_colors[2]` if it exists; otherwise pick a warm complement (orange/amber `#f59e0b`-family) when [0] is cool (blue/green/purple), or a cool complement when [0] is warm.
- `mesh_colors` = exactly 3 hex strings, ordered for left-to-right visual flow across the panoramic strip. Always include both gradient endpoints. The 3rd color should be the accent (or a desaturated mid-tone) to add warmth.
- If `analysis.brand_colors` is empty/missing, fall back to a category-appropriate palette inferred from `topics` and `description` — never invent specific hex values from earlier conversations.

### COPY RULES (production-grade)
1. Headlines MUST reference REAL outcomes of THIS app. Read the features list carefully.
2. **Headline length: 1 or 2 lines, 2–5 words total, ≤20 chars per line.** Single-line headlines are preferred when they fit. Never exceed 2 lines.
3. **Headlines must be OUTCOME-driven, not feature-listy.** The user buys outcomes (confidence, speed, compliance, calm, growth, savings), not features. Avoid headlines that are just feature counts ("17 Tools", "50+ Recipes") — instead promise the result the user gets ("STOP GUESSING", "PRO GRADE", "READY ANYWHERE").
4. **Subtitles**: ≤35 chars total, single line. Reinforce the outcome with a CONCRETE proof point taken from the source — a specific metric, standard, integration, count, or behavior pulled from README/code.
5. **Layout variety is mandatory**: Slot 1 = `hero_icon`. Across all 6 slots, use AT LEAST 4 distinct `layout_type` values from {`hero_icon`, `single_device`, `dual_device`, `device_top_crop`, `tilted_device`}. Tilted layouts go on screens with rich visual content; `device_top_crop` works best for the proof slot.
6. Use brand colors for the gradient. If no brand colors, pick professional ones matching the app category.
7. Each `screen_ui` MUST represent a DIFFERENT real screen of the app — do NOT show the same screen twice across the 6 slots.
8. Use the SOURCE CODE to determine what UI elements exist. If a screen has a list of tools, show those EXACT tool names. If a screen is a form, show the REAL field labels.
9. **NEVER include any of these in `screen_ui`**: "Rate Us", "Rate App", "Review", ad banners, "AdMob", interstitial ads, rewarded ads, "Premium", "Upgrade", "Subscribe", "In-App Purchase", "Watch Ad", splash screens, login/auth gates (unless the app is genuinely auth-first), or any monetization/promotional UI. Only show REAL app functionality screens.
10. Do NOT invent screens that don't exist in the source code. If you can only find 4 real screens, describe those 4 and reuse them in different states (different filter, different selection) — do not pad with generic filler screens.
11. **Every screen_ui MUST include a `bottom_nav` element** unless the screen is genuinely a fullscreen modal (onboarding, full-screen camera, fullscreen video). Tab labels must reflect the app's REAL navigation — read the navigator file to find them. Pick ONE active tab per screen — DIFFERENT across all 6 slots — and set `active_tab_index` accordingly. Tab names get auto-mapped to consistent line/filled SVG icons (Home, Tools, History, Reference, Settings, Search, Profile, Add, etc.) so do NOT specify emojis in the `icon` field for bottom_nav — leave it empty.
12. **`screen_ui.elements` should have 7-10 entries** for visual richness. Always include `status_bar` and `nav_bar` first. The `bottom_nav` must always be the LAST element.
13. **Production-grade polish on every screen.** A flat list of unstyled rows reads as a template. To make every device screen feel like a real iOS screenshot:
    - Pick ONE `list_item` per screen and set `selected: true` (the row that the imagined user just tapped or the row that best demonstrates the feature). Different slot, different selected row.
    - On every `chip_row`, set `active_index` to a chip OTHER THAN the first when it makes narrative sense (e.g. on a History slot show "Favorites" active, not "All").
    - Add ONE `badge` to a list_item where it adds information (e.g. saved-state, recency, freshness, status). Don't badge every row — pick the most informative one.
    - When the slot's role is CTA / Trust (slot 6), the screen should contain a `button` with `prominence: "primary"` whose text is short and benefit-driven.
    These polish hints take REAL data from the app source where possible.
14. **Project-asset usage (visuals come from the user's repo only).** All decorative imagery beyond the app icon and the in-device screen render MUST come from `analysis.project_assets`. Allowed: place ONE asset of `kind` in `{illustration, hero, splash, onboarding}` as a background image layer or accent shape on at most 2 of the 6 slots. Forbidden: external photos, AI-generated photos, stock imagery, fetched URLs. If `project_assets` has no usable kinds, every slot uses solid color + texture only — that is a valid, production-grade outcome, not a fallback to apologize for. Reference assets by `path` (the renderer can resolve relative paths against the target dir at runtime) or by `data_url` when present.

---

## PASS 2 — LAYOUT DESIGN

You are a professional Figma designer specializing in app store screenshot layouts. Take the content brief from Pass 1 and produce pixel-perfect layer specifications.

### CANVAS SPECIFICATIONS (CRITICAL — these are exact, non-negotiable)
- Canvas: 390px wide × 844px tall
- Export: 1080×1920px (automatic via pixelRatio)
- Content is CLIPPED at canvas edges (elements can extend past edges for bleed effect)

### DEVICE FRAME DIMENSIONS
- Raw frame size: 290px wide × 620px tall
- Rendered size = raw × scale
  - scale 0.85 → 247×527px
  - scale 0.80 → 232×496px
  - scale 0.75 → 218×465px
- Center formula: `x = (390 - 290 * scale) / 2`

### VALID DEVICE IDS (by framework)
- flutter: `"pixel-9-pro"`, `"pixel-8"`, `"samsung-s24-ultra"`, `"iphone-16-pro-max"`
- android-native: `"pixel-9-pro"`, `"pixel-8"`, `"samsung-s24-ultra"`, `"samsung-s23"`, `"oneplus-12"`
- ios-native: `"iphone-16-pro"`, `"iphone-16-pro-max"`, `"iphone-15-pro"`
- react-native: `"iphone-16-pro"`, `"pixel-9-pro"`, `"samsung-s24-ultra"`, `"iphone-16-pro-max"`
- web / unknown: `"iphone-16-pro"`, `"pixel-9-pro"`, `"samsung-s24-ultra"`, `"iphone-16-pro-max"`

The `iphone-16-pro` and `iphone-16-pro-max` and `iphone-15-pro` devices render with a dynamic island (Konva draws a black pill at top-center over the screen content). Prefer iPhone variants for editorial/serif themes and apps targeting iOS as a primary platform.

### TEXT BOUNDARY RULES (STRICT)
- Centered text: `x ≥ 20`, `width ≤ 350` (so text stays within 20..370)
- Left-aligned text: `x ≥ 25`, `width ≤ 340` (so text stays within 25..365)
- Text must NEVER have `x + width > 380`
- Headline `font_size`: 38-48px
- Subtitle `font_size`: 15-18px

### LAYOUT ARCHETYPES (follow EXACT y-values — calculated to prevent overlap)

#### `hero_icon`
TEXT ZONE: y 20–250 (top). DEVICE ZONE: y 300+ (bottom).
- App icon: x=168, y=30, size 55×55, corner_radius=12
- Headline: x=20, y=110, width=350, font_size=44, align="center"
- Subtitle: x=30, y=200, width=330, font_size=17, align="center"
- Device: x=72, y=320, scale=0.85, rotation=0
- 1 decorative shape in margin (x=-10..30 or x=320..400, y=230..280)

#### `single_device`
TEXT ZONE: y 20–180 (top). DEVICE ZONE: y 250+ (bottom).
- Headline: x=20, y=35, width=350, font_size=42, align="center"
- Subtitle: x=30, y=130, width=330, font_size=17, align="center"
- Device: x=72, y=280, scale=0.85, rotation=0
- 1 decorative shape

#### `dual_device`
TEXT ZONE: y 20–160 (top). DEVICE ZONE: y 280+ (bottom).
- Headline: x=20, y=35, width=350, font_size=42, align="center"
- Subtitle: x=30, y=120, width=330, font_size=16, align="center"
- Device 1: x=-20, y=300, scale=0.70, rotation=-5
- Device 2: x=180, y=320, scale=0.70, rotation=5
- NO decorative shapes

#### `device_top_crop`
TEXT ZONE: y 560–780 (bottom). DEVICE ZONE: y -80..500 (top).
- Device: x=72, y=-80, scale=0.85, rotation=0
- Headline: x=20, y=600, width=350, font_size=44, align="center"
- Subtitle: x=30, y=700, width=330, font_size=17, align="center"
- 1 decorative shape

#### `tilted_device`
TEXT ZONE: y 20–200 (top-left). DEVICE ZONE: y 280+ (bottom-right).
- Headline: x=25, y=50, width=340, font_size=46, align="left"
- Subtitle: x=25, y=150, width=340, font_size=16, align="left"
- Device: x=100, y=320, scale=0.80, rotation=6
- 1 decorative shape

### CRITICAL SPACING RULES
- Subtitle y MUST be at least `(headline_y + headline_font_size * 2 + 10)` pixels below headline
- Device y MUST be at least `(subtitle_y + 50)` pixels below subtitle
- For 2-line headlines (with `\n`), add extra 50px gap: `subtitle_y = headline_y + font_size * 2 + 60`
- NEVER place subtitle at same y as headline or device. They must be in SEPARATE vertical zones.

### LAYER ORDER (bottom-to-top)
Each screenshot needs layers in this order:
1. background (exactly 1, always first)
2. decorative shapes (0-2, subtle, opacity 0.08-0.15)
3. icon (0-1, only for `hero_icon` layout)
4. device(s) (per `device_count`)
5. headline text
6. subtitle text

For background: use `"mesh"` type with theme `mesh_colors`. Vary `mesh_seed` per screenshot (use 42, 137, 256, 389, 512, 777). All 6 slots use the SAME `mesh_colors` so the panoramic strip stitches across slot boundaries.

For text: use theme fonts. Headline uses `headline_font` + `headline_weight`. Subtitle uses `body_font` + `"400"`.

For devices: use `"clay"` `frame_style`, `"#ffffff"` `frame_color`. Pick `device_id` matching the framework.

For shapes: use `accent_color` from theme, `opacity` 0.08-0.15, place in margins/corners away from text and device.

---

## PASS 3 — VALIDATION

You are a QA reviewer. Re-read your Pass 2 output and CHECK / FIX every screenshot for:

1. **TEXT OVERFLOW**: Any text layer where `x + width > 380` → reduce width or increase x
2. **TEXT-DEVICE OVERLAP**: Headline/subtitle text overlapping device frame → adjust y to create ≥30px gap
3. **TEXT TOO LONG**: Any headline >2 lines OR any line >20 characters OR total word count >5 → shorten the text
4. **SUBTITLE TOO LONG**: Any subtitle > 35 characters → shorten the text
5. **DEVICE OUT OF BOUNDS**: Device positioned so it's completely invisible (`x > 390` or `y > 844` or `x < -290` or `y < -620`) → fix position
6. **MISSING BACKGROUND**: Screenshot without a background layer → add default mesh background
7. **FONT SIZE**: Headline `font_size < 36` → increase to at least 38
8. **TEXT POSITION**: Any text with `y < 15` or (`y > 750` and it's a headline) → adjust y
9. **HARDCODED CONTENT LEAK**: Verify NO copy, color, screen-name, or list-item text was carried over from earlier conversations or example apps. Every string must trace back to the current `analysis.json` or to a file you Read on the user's disk.
10. **NARRATIVE ARC INTEGRITY**: Slot 1 is `hero_icon`. Slot 6 carries trust/proof content (not a generic feature). 6 unique screens. ≥4 distinct layout types. Active tab differs across slots.
11. **BOTTOM NAV CONSISTENCY**: Every screen with `has_bottom_nav: true` ends its `elements` array with exactly one `bottom_nav` element whose `icon` field is empty.

Output the COMPLETE corrected layout with ALL screenshots and ALL layers (including ones that didn't need changes).

---

## PASS 4 — FEATURE GRAPHIC

In addition to the 6 screenshots, produce ONE Feature Graphic — a 1024×500 landscape banner that appears at the top of a Google Play Store listing.

The Feature Graphic is NOT a screenshot. It's a marketing banner. It must:
- Reuse the SAME `theme` block as the screenshots (fonts, mesh_colors, accent — so the FG reads as the same campaign).
- Reuse a SLOT'S in-device screen render via `source_slot` (don't author new screen content).
- Be tighter than slot headlines: vertical space is ~30% of a slot, so headlines are SHORTER.
- Carry no `screen_ui` — only `layers[]` (subset: background | device | text | shape | icon).

### CANVAS SPECIFICATIONS
- Logical canvas: 512px wide × 250px tall (renderer applies pixelRatio=2 → 1024×500 export).
- Content is CLIPPED at canvas edges (devices may be partially cropped for "bleed" effect).

### LAYOUT ARCHETYPES (pick ONE per FG)

#### `left_text_right_device`
- Headline: `x=24, y=60, width=260, font_size=44, align="left"`
- Subtitle: `x=24, y=160, width=260, font_size=15, align="left"` (optional)
- Device: `x=300, y=18, scale=0.40, rotation=8` (~116×248 — fits within 250 height with breathing room)
- App icon (optional): `x=24, y=22, width=36, height=36, corner_radius=8`

#### `centered_dual_device`
- Headline (top): `x=20, y=18, width=472, font_size=36, align="center"`
- Subtitle (bottom): `x=20, y=210, width=472, font_size=14, align="center"` (optional)
- Device 1: `x=80, y=44, scale=0.32, rotation=-6`
- Device 2: `x=290, y=52, scale=0.32, rotation=6`

#### `full_bleed_solid_with_corner_device`
- Headline: `x=20, y=88, width=472, font_size=56, align="center"`
- Subtitle: `x=20, y=170, width=472, font_size=15, align="center"` (optional)
- Device: `x=360, y=130, scale=0.35, rotation=12` (cropped bottom-right)
- App icon (optional): `x=24, y=24, width=44, height=44`

### `device.source_slot` (REQUIRED on every device layer in the FG)
The FG MUST reuse a screen render that was already produced for one of the 6 slots. Set `source_slot` on each device layer to the EXACT `name` of the screenshot whose in-device content you want to display. Example: `"source_slot": "Hero"` reuses the Hero slot's screen image. The runtime resolves `source_slot` → the same `screenshotUrl` already in memory; no extra render call happens.

### TEXT BOUNDARY RULES (FG)
- Centered text: `x ≥ 20`, `width ≤ 472` (so text stays within 20..492)
- Left text: `x ≥ 24`, `width ≤ 460` (so text stays within 24..484)
- Headline `font_size`: 36-56 px (smaller than slot headlines because vertical space is tighter)
- Subtitle `font_size`: 13-16 px
- Headline copy: 1 line preferred, 2 lines max, **2–4 words total, ≤18 chars per line**, ALL CAPS. Even tighter than slot headlines.

### Background for FG
Use `background_type: "mesh"` with the SAME `mesh_colors` from `theme.mesh_colors`. Pick a unique `mesh_seed` (suggested 999 — outside the 6 slot seeds). Do not set `panoramic_slot` / `panoramic_total` on the FG; it stands alone.

### FG VALIDATION (apply before writing)
1. Exactly ONE `featureGraphic` block.
2. ≥1 background layer first; ≥1 text layer; ≥1 device layer.
3. Every device layer has a non-empty `source_slot` matching one of the `screenshots[].name` values verbatim.
4. Headline ≤2 lines, ≤4 words total, ≤18 chars per line.
5. Subtitle ≤40 chars when present.
6. No text layer where `x + width > 502`.
7. Device must fit: `device.x + 290*scale ≤ 532` AND `device.y + 620*scale ≤ 320` (32px overflow allowed for cropped archetypes).
8. App icon (when present) sits ≥20 logical px from each canvas edge.

---

## FINAL OUTPUT SCHEMA — `briefs.json`

The output you write is consumed by `frontend/src/stores/mockupStore.ts` and `frontend/src/lib/renderScreenshot.ts`. The schema:

```json
{
  "version": 1,
  "generatedAt": "<ISO 8601 timestamp the wrapper passes in>",
  "appName": "<analysis.app_name verbatim>",
  "appIconUrl": "<analysis.app_icon_url verbatim — typically data:image/...;base64,...>",
  "projectAssets": "<copy analysis.project_assets verbatim if any image_placeholder asset_url references one of its entries; otherwise omit>",
  "theme": {
    "headline_font": "...",
    "body_font": "...",
    "headline_weight": "700",
    "mood": "...",
    "accent_color": "#...",
    "primary_gradient_start": "#...",
    "primary_gradient_end": "#...",
    "mesh_colors": ["#...", "#...", "#..."]
  },
  "screenshots": [
    {
      "name": "<screen_name>",
      "screen_ui": { "screen_title": "...", "has_bottom_nav": true, "active_tab_index": 0, "elements": [/* ScreenUIElement[] */] },
      "layers": [
        {
          "type": "background",
          "name": "Background",
          "background_type": "mesh",
          "fill": "#ffffff",
          "gradient_start": null,
          "gradient_end": null,
          "gradient_angle": 0,
          "mesh_colors": ["#...", "#...", "#..."],
          "mesh_seed": 42,
          "image_query": null,
          "overlay_opacity": 0.4
        },
        { "type": "device", "name": "Device", "device_id": "pixel-9-pro", "x": 72, "y": 320, "scale": 0.85, "rotation": 0, "frame_style": "clay", "frame_color": "#ffffff" },
        { "type": "text", "name": "Headline", "text": "<2-6 words ALL CAPS>", "font_family": "Inter", "font_weight": "700", "font_size": 44, "fill": "#ffffff", "align": "center", "x": 20, "y": 110, "width": 350, "rotation": 0, "opacity": 1 },
        { "type": "text", "name": "Subtitle", "text": "...", "font_family": "Inter", "font_weight": "400", "font_size": 17, "fill": "#ffffff", "align": "center", "x": 30, "y": 200, "width": 330, "rotation": 0, "opacity": 0.9 },
        { "type": "icon", "name": "App Icon", "x": 168, "y": 30, "width": 55, "height": 55, "corner_radius": 12 },
        { "type": "shape", "name": "Decoration", "shape_type": "rect", "fill": "#...", "x": -10, "y": 230, "width": 80, "height": 80, "corner_radius": 40, "rotation": 0, "opacity": 0.12 }
      ]
    }
    /* ... 5 more screenshots ... */
  ],
  "featureGraphic": {
    "name": "Feature Graphic",
    "layers": [
      {
        "type": "background", "name": "Background", "background_type": "mesh",
        "fill": "#ffffff", "gradient_start": null, "gradient_end": null, "gradient_angle": 0,
        "mesh_colors": ["#...", "#...", "#..."], "mesh_seed": 999,
        "image_query": null, "overlay_opacity": 0.4
      },
      { "type": "device", "name": "Device", "device_id": "iphone-16-pro", "x": 300, "y": 18, "scale": 0.40, "rotation": 8, "frame_style": "clay", "frame_color": "#ffffff", "source_slot": "Hero" },
      { "type": "text", "name": "Headline", "text": "TRADE GRADE", "font_family": "Manrope", "font_weight": "800", "font_size": 44, "fill": "#ffffff", "align": "left", "x": 24, "y": 60, "width": 260, "rotation": 0, "opacity": 1 },
      { "type": "text", "name": "Subtitle", "text": "17 NEC-ready calculators", "font_family": "Inter", "font_weight": "400", "font_size": 15, "fill": "#ffffff", "align": "left", "x": 24, "y": 160, "width": 260, "rotation": 0, "opacity": 0.92 },
      { "type": "icon", "name": "App Icon", "x": 24, "y": 22, "width": 36, "height": 36, "corner_radius": 8 }
    ]
  }
}
```

Produce exactly 6 entries in `screenshots` AND exactly 1 `featureGraphic` block. Each screenshot MUST have a `background` layer first and at least a headline text layer. The featureGraphic MUST have a `background`, ≥1 `text`, and ≥1 `device` layer with a valid `source_slot`. Validate every layer against the rules in Pass 3 (screenshots) and Pass 4 (featureGraphic) before outputting.
