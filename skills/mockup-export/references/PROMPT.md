# Synthesis prompt — produce briefs.json from analysis.json

**Output ONLY a single JSON object matching the schema below. No preamble, no code fences, no commentary, no explanation. Just the JSON.**

You will run FOUR reasoning passes internally and combine them into one final JSON output. Do not show intermediate work — only the final JSON.

---

## PASS 0 — NARRATIVE ARC (do this BEFORE writing any copy)

The 6 slots are not 6 independent posters. They tell a story. Per 2026 Play Store research, optimized 6-slot sets drive ~24% conversion uplift. **Pick one of these arcs and assign each of your 6 screen_names to a slot role:**

**Arc A (recommended for utility/productivity apps):**
1. **Hook** — biggest emotional headline. Why someone needs this. (e.g. "ELECTRIC GRADE", "STOP GUESSING")
2. **Problem in detail** — the specific pain this solves, shown with a feature screen
3. **Core feature** — the headline calculator/screen the user came for
4. **Breadth** — show range/variety (lists, categories, advanced features)
5. **Proof / Social** — history, saved data, projects, exports — *evidence that pros use this*
6. **CTA / Trust** — pricing, offline-capable, install promise, App Store ratings, NEC/standard compliance

**Arc B (AIDA — recommended for entertainment/lifestyle):**
1. Attention (a striking visual hook)
2. Interest (what's inside)
3. Desire-1 (feature)
4. Desire-2 (feature)
5. Action (call to use)
6. Confirmation (testimonials/reviews)

**Mandatory rule:** the FINAL slot must contain a trust/proof element (offline badge, NEC compliance, "Works on the truck", count of users, etc.). Never use a generic feature screen as slot 6.

---

## INPUTS

You are given:

1. `analysis.json` — analysis bundle from a GitHub repo. Fields: `app_name`, `framework`, `description`, `topics`, `brand_colors`, `features`, `screens`, `readme_full`, `source_context`, `pkg_description`, `app_icon_url`, `key_files`, `file_count`.
2. The output of this prompt is a `briefs.json` file consumed by an existing Konva-based renderer.

---

## PASS 1 — CONTENT BRIEF

You are an ASO (App Store Optimization) copywriter AND a mobile UI designer. Your job is to write marketing headlines AND describe the EXACT app screens for device mockups.

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
- `headline`: MAX 2 lines, MAX 10 CHARACTERS PER LINE. ALL CAPS. Use `\n` for line break. Examples: `"TRACK\nPROGRESS"`, `"WIRE SIZE\n& VOLTS"`, `"SAVE\nPROJECTS"`
- `subtitle`: MAX 30 CHARACTERS. Single line. Brief benefit. Example: `"17 NEC-ready tools"`
- `layout_type`: one of `"hero_icon"`, `"single_device"`, `"dual_device"`, `"device_top_crop"`, `"tilted_device"`
- `device_count`: 0, 1, or 2
- `screen_ui`: structured description of what the ACTUAL APP SCREEN looks like inside the device frame. This must mirror the REAL app UI based on the source code. Include:
  - `screen_title`: the title shown in the navigation bar (e.g. the actual screen name from the app)
  - `has_bottom_nav`: true if this screen has a tab bar at the bottom
  - `active_tab_index`: which tab is highlighted (0-4)
  - `elements`: 6-12 UI elements in order from top to bottom. Each has:
    - `element_type`: one of `"status_bar"`, `"nav_bar"`, `"tab_bar"`, `"list_item"`, `"card"`, `"button"`, `"input_field"`, `"text_block"`, `"hero_banner"`, `"toggle_row"`, `"avatar_row"`, `"stat_card"`, `"divider"`, `"bottom_nav"`, `"search_bar"`, `"chip_row"`, `"image_placeholder"`
    - `text`: PRIMARY text shown — use REAL text from the app (actual menu labels, feature names, button labels from the source code)
    - `secondary_text`: subtitle or description (`""` if none)
    - `icon`: a relevant emoji (e.g. `"⚡"` for voltage, `"📐"` for measurements, `"⚙️"` for settings), or `""` for none

### CRITICAL RULES FOR `screen_ui`
- Read the SOURCE CODE and extract ACTUAL screen names, menu items, button labels, and navigation structure.
- If the app has screens like "Wire Size Calculator", "Voltage Drop", "Conduit Fill" — use THOSE EXACT names as `list_item` text, NOT generic "Feature 1".
- If the app has tabs/navigation — replicate the REAL tab names.
- The `screen_ui` must look like a REAL screenshot of THIS specific app, not a generic template.
- Use element types that match the actual UI: list of calculators → `list_item`s; form → `input_field`s; cards → `card`s.

### Unified design `theme`
- `headline_font`: pick from `"Inter"`, `"Montserrat"`, `"Oswald"`, `"Space Grotesk"`, `"DM Sans"`, `"Poppins"`, `"Playfair Display"`, `"Raleway"`, `"Nunito"`, `"Manrope"`
- `body_font`: pick from `"Inter"`, `"Roboto"`, `"Open Sans"`, `"Lato"`, `"DM Sans"`, `"Manrope"`
- `headline_weight`: `"700"` or `"800"`
- `mood`: `"professional"`, `"energetic"`, `"dark"`, `"minimal"`, `"bold"`, `"premium"`
- `accent_color`: hex color for decorative elements
- `primary_gradient_start`, `primary_gradient_end`: hex colors derived from brand colors
- `mesh_colors`: exactly 3 hex colors for mesh gradients

### RULES
1. Headlines MUST reference REAL features of THIS app. Read the features list carefully.
2. **Headline length: 2–6 words TOTAL across both lines.** Examples: "WIRE SIZE & VOLTS" (4), "EVERY TOOL\nYOU NEED" (4), "SAVE\nPROJECTS" (2). Never more than 12 chars per line.
3. **Headlines must be OUTCOME-driven, not feature-listy.** Bad: "17 NEC Calculators". Good: "ELECTRIC GRADE" or "STOP GUESSING". The user buys outcomes (confidence, speed, code-compliance), not features.
4. Subtitles: 8–12 words MAX, ≤35 chars total. Single line. Reinforce the outcome with a concrete proof point: "17 NEC-ready tools", "Live NEC 310.16 sizing", "Per-client notes & PDFs".
5. **Layout variety is mandatory:** Slot 1 = `hero_icon`. Across all 6 slots, use AT LEAST 4 distinct `layout_type` values from {`hero_icon`, `single_device`, `dual_device`, `device_top_crop`, `tilted_device`}. Tilted layouts go on screens with rich visual content; `device_top_crop` works best for the "proof" slot 5.
6. Use brand colors for the gradient. If no brand colors, pick professional ones matching the app category.
7. Each `screen_ui` MUST represent a DIFFERENT real screen of the app — do NOT show the same screen twice.
8. Use the SOURCE CODE to determine what UI elements exist. If a screen has a list of tools/calculators, show those EXACT tool names.
9. NEVER include any of these in `screen_ui`: "Rate Us", "Rate App", "Review", ad banners, "AdMob", interstitial ads, rewarded ads, "Premium", "Upgrade", "Subscribe", "In-App Purchase", "Watch Ad", splash screens, or any monetization/promotional UI. Only show REAL app functionality screens.
10. Do NOT invent screens that don't exist in the source code. If you can only find 4 real screens, describe those 4 — do not pad with generic filler screens.
11. **Every screen_ui MUST include a `bottom_nav` element** (unless the screen is genuinely a fullscreen modal like onboarding). Tab labels must reflect the app's REAL navigation (read `App.tsx` and route configs to find them). Pick ONE active tab per screen — different across all 6 slots — and set `active_tab_index` accordingly. Tab names get auto-mapped to consistent line/filled SVG icons (Home, Tools, History, Reference, Settings, Search, Profile, Add) so do NOT specify emojis in the `icon` field for bottom_nav — leave it empty.
12. **`screen_ui.elements` should have 7-10 entries** for visual richness — don't underfill the device screen. Always include `status_bar` and `nav_bar` first.

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
- ios-native: `"iphone-16-pro-max"`, `"iphone-15-pro"`
- react-native: `"pixel-9-pro"`, `"samsung-s24-ultra"`, `"iphone-16-pro-max"`
- web / unknown: `"pixel-9-pro"`, `"samsung-s24-ultra"`, `"iphone-16-pro-max"`

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

For background: use `"mesh"` type with theme `mesh_colors`. Vary `mesh_seed` per screenshot (use 42, 137, 256, 389, 512, 777).

For text: use theme fonts. Headline uses `headline_font` + `headline_weight`. Subtitle uses `body_font` + `"400"`.

For devices: use `"clay"` `frame_style`, `"#ffffff"` `frame_color`. Pick `device_id` matching the framework.

For shapes: use `accent_color` from theme, `opacity` 0.08-0.15, place in margins/corners away from text and device.

---

## PASS 3 — VALIDATION

You are a QA reviewer. Re-read your Pass 2 output and CHECK / FIX every screenshot for:

1. **TEXT OVERFLOW**: Any text layer where `x + width > 380` → reduce width or increase x
2. **TEXT-DEVICE OVERLAP**: Headline/subtitle text overlapping device frame → adjust y to create ≥30px gap
3. **TEXT TOO LONG**: Any headline line > 12 characters → shorten the text
4. **SUBTITLE TOO LONG**: Any subtitle > 35 characters → shorten the text
5. **DEVICE OUT OF BOUNDS**: Device positioned so it's completely invisible (`x > 390` or `y > 844` or `x < -290` or `y < -620`) → fix position
6. **MISSING BACKGROUND**: Screenshot without a background layer → add default mesh background
7. **FONT SIZE**: Headline `font_size < 36` → increase to at least 38
8. **TEXT POSITION**: Any text with `y < 15` or (`y > 750` and it's a headline) → adjust y

Output the COMPLETE corrected layout with ALL screenshots and ALL layers (including ones that didn't need changes).

---

## FINAL OUTPUT SCHEMA — `briefs.json`

The output you write is consumed by `frontend/src/stores/mockupStore.ts` and `frontend/src/lib/renderScreenshot.ts`. The schema:

```json
{
  "version": 1,
  "generatedAt": "<ISO 8601 timestamp the wrapper passes in>",
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
        { "type": "text", "name": "Headline", "text": "TRACK\nPROGRESS", "font_family": "Inter", "font_weight": "700", "font_size": 44, "fill": "#ffffff", "align": "center", "x": 20, "y": 110, "width": 350, "rotation": 0, "opacity": 1 },
        { "type": "text", "name": "Subtitle", "text": "...", "font_family": "Inter", "font_weight": "400", "font_size": 17, "fill": "#ffffff", "align": "center", "x": 30, "y": 200, "width": 330, "rotation": 0, "opacity": 0.9 },
        { "type": "icon", "name": "App Icon", "x": 168, "y": 30, "width": 55, "height": 55, "corner_radius": 12 },
        { "type": "shape", "name": "Decoration", "shape_type": "rect", "fill": "#...", "x": -10, "y": 230, "width": 80, "height": 80, "corner_radius": 40, "rotation": 0, "opacity": 0.12 }
      ]
    }
    /* ... 5 more screenshots ... */
  ]
}
```

Produce exactly 6 entries in `screenshots`. Each MUST have a `background` layer first and at least a headline text layer. Validate every layer against the rules in Pass 3 before outputting.
