import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/render-screen
 *
 * Accepts a screen_ui JSON and returns a full HTML page that renders
 * the screen as styled HTML/CSS looking like a real mobile app.
 *
 * Playwright hits this endpoint from the backend to screenshot it.
 */

interface ScreenUIElement {
  element_type: string;
  text: string;
  secondary_text: string;
  icon: string;
}

interface ScreenUI {
  screen_title: string;
  elements: ScreenUIElement[];
  has_bottom_nav: boolean;
  active_tab_index: number;
}

interface RenderRequest {
  screen_ui: ScreenUI;
  app_name: string;
  primary_color: string;
  accent_color: string;
  is_dark: boolean;
  // Phase v0.3.0 — extracted from target source by Claude (PASS 0.5).
  // Drives every fontSize / padding / color / corner_radius the renderer paints
  // so the in-device screen visually matches the target app rather than
  // rendering with generic defaults. When absent, the renderer falls back to
  // a documented profile (still functional, just not target-matched).
  style_profile?: StyleProfile;
}

// Loose StyleProfile shape mirroring loadBriefs.ts. Server-side, not exported.
interface StyleRamp {
  size: number;
  weight: string;
  family: string;
  letter_spacing?: number;
}
interface StyleGradientTok { name: string; colors: string[]; angle: number }
interface StyleProfile {
  type_ramp: { display: StyleRamp; title: StyleRamp; body: StyleRamp; caption: StyleRamp };
  colors: {
    primary: string; secondary: string | null; accent: string;
    background: string; surface: string;
    label_primary: string; label_secondary: string; separator: string;
  };
  gradients: StyleGradientTok[];
  spacing: number[];
  shape: { card: number; button: number; input: number; chip: number; sheet: number };
  density: { list_row_height: number; button_height: number; tab_bar_height: number; input_height: number };
  elevation: { card: number; button: number; modal: number; sheet: number };
  mood_modifiers: {
    uppercase_buttons: boolean; letter_spaced_titles: boolean;
    text_shadows: boolean; bold_outlines: boolean; drop_caps: boolean;
  };
}

// Documented default — used when the request omits style_profile. Matches the
// v0.2.0 generic look so existing pipelines keep producing the same output.
const DEFAULT_PROFILE: StyleProfile = {
  type_ramp: {
    display: { size: 28, weight: "700", family: "System", letter_spacing: 0 },
    title:   { size: 17, weight: "700", family: "System", letter_spacing: 0 },
    body:    { size: 15, weight: "600", family: "System", letter_spacing: 0 },
    caption: { size: 12, weight: "500", family: "System", letter_spacing: 0 },
  },
  colors: {
    primary: "#4f46e5", secondary: "#7c3aed", accent: "#f59e0b",
    background: "#F5F5F7", surface: "#FFFFFF",
    label_primary: "#1A1A1A", label_secondary: "rgba(0,0,0,0.62)", separator: "rgba(0,0,0,0.06)",
  },
  gradients: [],
  spacing: [4, 8, 12, 16, 20, 24, 32],
  shape: { card: 14, button: 12, input: 12, chip: 999, sheet: 20 },
  density: { list_row_height: 60, button_height: 48, tab_bar_height: 72, input_height: 44 },
  elevation: { card: 1, button: 1, modal: 4, sheet: 3 },
  mood_modifiers: {
    uppercase_buttons: false, letter_spaced_titles: false,
    text_shadows: false, bold_outlines: false, drop_caps: false,
  },
};

// Defensive merge — caller may send partial profile; fill missing keys.
function profileOrDefault(p: StyleProfile | undefined): StyleProfile {
  if (!p) return DEFAULT_PROFILE;
  return {
    type_ramp: { ...DEFAULT_PROFILE.type_ramp, ...(p.type_ramp || {}) },
    colors: { ...DEFAULT_PROFILE.colors, ...(p.colors || {}) },
    gradients: Array.isArray(p.gradients) ? p.gradients : [],
    spacing: Array.isArray(p.spacing) && p.spacing.length >= 3 ? p.spacing : DEFAULT_PROFILE.spacing,
    shape: { ...DEFAULT_PROFILE.shape, ...(p.shape || {}) },
    density: { ...DEFAULT_PROFILE.density, ...(p.density || {}) },
    elevation: { ...DEFAULT_PROFILE.elevation, ...(p.elevation || {}) },
    mood_modifiers: { ...DEFAULT_PROFILE.mood_modifiers, ...(p.mood_modifiers || {}) },
  };
}

// Build a CSS linear-gradient from a named profile gradient, or fallback to the
// supplied two-color gradient. Used by hero_banner and primary buttons so they
// adopt the target app's actual brand gradient when one was extracted.
function gradientCss(profile: StyleProfile, name: string, fallbackFrom: string, fallbackTo: string): string {
  const g = profile.gradients.find(g => g.name === name);
  if (g && Array.isArray(g.colors) && g.colors.length >= 2) {
    const angle = typeof g.angle === "number" ? g.angle : 135;
    return `linear-gradient(${angle}deg, ${g.colors.join(", ")})`;
  }
  return `linear-gradient(135deg, ${fallbackFrom}, ${fallbackTo})`;
}

// Resolve a "System" font-family declaration into the iOS+Android stack so
// device frames pick the right native font. Custom families are quoted.
function resolveFontStack(family: string | undefined): string {
  const f = family || "System";
  return f === "System" || f === "system"
    ? `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif`
    : `'${f}', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif`;
}

function getColors(primary: string, accent: string, isDark: boolean, profile?: StyleProfile) {
  // Phase v0.3.0 — when profile present, its colors take precedence. The
  // light/dark derivation still produces muted/textSubtle variants the
  // schema doesn't carry.
  const pc = profile?.colors;
  return {
    bg: pc?.background ?? (isDark ? "#0F1117" : "#F5F5F7"),
    cardBg: pc?.surface ?? (isDark ? "#1A1B23" : "#FFFFFF"),
    text: pc?.label_primary ?? (isDark ? "#EEEEF0" : "#1A1A1A"),
    muted: pc?.label_secondary ?? (isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)"),
    primary: pc?.primary ?? primary,
    accent: pc?.accent ?? accent,
    border: pc?.separator ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
  };
}

interface RenderCtx {
  c: ReturnType<typeof getColors>;
  profile: StyleProfile;
}

function renderElement(el: ScreenUIElement, ctx: RenderCtx, index: number): string {
  const c = ctx.c;
  const profile = ctx.profile;
  switch (el.element_type) {
    case "status_bar":
      return `<div style="display:flex;justify-content:space-between;padding:12px 20px 8px;font-size:13px;font-weight:600;color:${c.text}">
        <span>9:41</span><span>●●●● ▌</span>
      </div>`;

    case "nav_bar": {
      // Phase v0.3.0 — typography from profile.type_ramp.title; letter_spacing
      // honors mood_modifiers.letter_spaced_titles for game/marketing apps that
      // use tracked headlines.
      const tt = profile.type_ramp.title;
      const ls = profile.mood_modifiers.letter_spaced_titles
        ? `${Math.max(1, tt.letter_spacing ?? 1)}px`
        : "0";
      const shadowCss = profile.mood_modifiers.text_shadows
        ? "text-shadow:0 1px 2px rgba(0,0,0,0.25);"
        : "";
      const family = tt.family === "System" ? "inherit" : `'${tt.family}'`;
      return `<div style="padding:8px 20px 16px;display:flex;align-items:center;gap:12px">
        <span style="color:${c.primary};font-size:18px">‹</span>
        <span style="font-size:${tt.size}px;font-weight:${tt.weight};font-family:${family};color:${c.text};letter-spacing:${ls};${shadowCss}">${esc(el.text)}</span>
      </div>`;
    }

    case "search_bar":
      return `<div style="margin:4px 20px 12px;padding:10px 16px;background:${c.cardBg};border-radius:10px;display:flex;align-items:center;gap:8px">
        <span style="color:${c.muted};font-size:14px">🔍</span>
        <span style="color:${c.muted};font-size:14px">${esc(el.text) || "Search…"}</span>
      </div>`;

    case "hero_banner": {
      // Phase v0.3.0 — display ramp typography, primary_cta gradient (or
      // brand-color fallback), card-shape radius, optional letter spacing on
      // game-style headlines.
      const td = profile.type_ramp.display;
      const bg = gradientCss(profile, "primary_cta", c.primary, c.accent);
      const ls = profile.mood_modifiers.letter_spaced_titles
        ? `${Math.max(1, td.letter_spacing ?? 1)}px`
        : "-0.4px";
      const shadowCss = profile.mood_modifiers.text_shadows
        ? "text-shadow:0 2px 4px rgba(0,0,0,0.3);"
        : "";
      const radius = profile.shape.card;
      const family = td.family === "System" ? "inherit" : `'${td.family}'`;
      return `<div style="margin:8px 20px;padding:24px;border-radius:${radius}px;background:${bg};color:#fff;position:relative;overflow:hidden">
        ${el.icon ? `<div style="font-size:28px;margin-bottom:8px">${esc(el.icon)}</div>` : ""}
        <div style="font-size:${td.size}px;font-weight:${td.weight};font-family:${family};margin-bottom:6px;letter-spacing:${ls};${shadowCss}">${esc(el.text)}</div>
        ${el.secondary_text ? `<div style="font-size:${profile.type_ramp.body.size}px;font-weight:${profile.type_ramp.body.weight};opacity:0.92">${esc(el.secondary_text)}</div>` : ""}
        <div style="position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:60px;background:rgba(255,255,255,0.08)"></div>
      </div>`;
    }

    case "list_item": {
      // Phase v0.3.0 — body/caption typography from profile, list_row_height
      // from density, separator color from colors.separator (already in c.border).
      const tb = profile.type_ramp.body;
      const tc = profile.type_ramp.caption;
      const rowH = profile.density.list_row_height;
      // Vertical padding derived from row height, not hard-coded
      const padY = Math.max(8, Math.round((rowH - tb.size - (el.secondary_text ? tc.size + 4 : 0)) / 2));
      return `<div style="display:flex;align-items:center;padding:${padY}px 20px;gap:14px;border-bottom:1px solid ${c.border};min-height:${rowH}px;box-sizing:border-box">
        ${el.icon ? `<div style="width:36px;height:36px;border-radius:${Math.min(profile.shape.card, 12)}px;background:${c.primary}15;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${esc(el.icon)}</div>` : ""}
        <div style="flex:1;min-width:0">
          <div style="font-size:${tb.size}px;font-weight:${tb.weight};color:${c.text}">${esc(el.text)}</div>
          ${el.secondary_text ? `<div style="font-size:${tc.size}px;font-weight:${tc.weight};color:${c.muted};margin-top:2px">${esc(el.secondary_text)}</div>` : ""}
        </div>
        <span style="color:${c.muted};font-size:16px">›</span>
      </div>`;
    }

    case "card": {
      // Phase v0.3.0 — title typography for header, body for description, card
      // shape token for radius, bold_outlines mood modifier for thicker accent.
      const tt = profile.type_ramp.title;
      const tb = profile.type_ramp.body;
      const accentWidth = profile.mood_modifiers.bold_outlines ? 5 : 4;
      const radius = profile.shape.card;
      return `<div style="margin:8px 20px;padding:18px;border-radius:${radius}px;background:${c.cardBg};border-left:${accentWidth}px solid ${c.primary};box-shadow:0 1px 3px rgba(0,0,0,0.06)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          ${el.icon ? `<span style="font-size:18px">${esc(el.icon)}</span>` : ""}
          <span style="font-size:${tt.size}px;font-weight:${tt.weight};color:${c.text}">${esc(el.text)}</span>
        </div>
        ${el.secondary_text ? `<div style="font-size:${tb.size}px;font-weight:400;color:${c.muted}">${esc(el.secondary_text)}</div>` : ""}
      </div>`;
    }

    case "stat_card": {
      const isEven = index % 2 === 0;
      const marginLeft = isEven ? "20px" : "6px";
      const marginRight = isEven ? "6px" : "20px";
      return `<div style="display:inline-block;width:calc(50% - 26px);vertical-align:top;margin:6px ${marginRight} 6px ${marginLeft};padding:16px;border-radius:14px;background:${c.cardBg};box-shadow:0 1px 3px rgba(0,0,0,0.06)">
        <div style="height:3px;border-radius:2px;background:linear-gradient(90deg,${c.primary},${c.accent});margin-bottom:12px"></div>
        ${el.icon ? `<div style="font-size:14px;margin-bottom:4px">${esc(el.icon)}</div>` : ""}
        <div style="font-size:22px;font-weight:700;color:${c.text}">${esc(el.text)}</div>
        ${el.secondary_text ? `<div style="font-size:11px;color:${c.muted};margin-top:4px">${esc(el.secondary_text)}</div>` : ""}
      </div>`;
    }

    case "button": {
      // Phase v0.3.0 — button shape + density + uppercase mood + body
      // typography. Uses primary_cta gradient when available, brand-color
      // fallback otherwise. Letter spacing on uppercase buttons (game style).
      const tb = profile.type_ramp.body;
      const buttonH = profile.density.button_height;
      const radius = profile.shape.button;
      const upper = profile.mood_modifiers.uppercase_buttons;
      const text = upper ? esc(el.text).toUpperCase() : esc(el.text);
      const ls = upper ? "1.5px" : "0";
      const bg = gradientCss(profile, "primary_cta", c.primary, c.accent);
      const family = tb.family === "System" ? "inherit" : `'${tb.family}'`;
      const weight = upper ? "700" : tb.weight;
      const shadow = profile.elevation.button >= 2
        ? "box-shadow:0 4px 12px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.1);"
        : "box-shadow:0 2px 6px rgba(0,0,0,0.1);";
      return `<div style="margin:12px 20px">
        <div style="height:${buttonH}px;display:flex;align-items:center;justify-content:center;border-radius:${radius}px;background:${bg};color:#fff;font-weight:${weight};font-size:${tb.size}px;font-family:${family};letter-spacing:${ls};${shadow}">${text}</div>
      </div>`;
    }

    case "input_field":
      return `<div style="margin:6px 20px">
        ${el.secondary_text ? `<div style="font-size:12px;color:${c.muted};margin-bottom:4px">${esc(el.secondary_text)}</div>` : ""}
        <div style="padding:12px 14px;border:1.5px solid ${c.border};border-radius:10px;background:${c.cardBg};color:${c.muted};font-size:14px">${esc(el.text)}</div>
      </div>`;

    case "text_block":
      return `<div style="padding:8px 20px">
        <div style="font-size:16px;font-weight:600;color:${c.text}">${esc(el.text)}</div>
        ${el.secondary_text ? `<div style="font-size:13px;color:${c.muted};margin-top:4px">${esc(el.secondary_text)}</div>` : ""}
      </div>`;

    case "toggle_row":
      return `<div style="display:flex;align-items:center;padding:14px 20px;border-bottom:1px solid ${c.border}">
        ${el.icon ? `<span style="font-size:16px;margin-right:12px">${esc(el.icon)}</span>` : ""}
        <span style="flex:1;font-size:15px;color:${c.text}">${esc(el.text)}</span>
        <div style="width:44px;height:26px;border-radius:13px;background:${index % 2 === 0 ? c.primary : c.border};position:relative">
          <div style="width:22px;height:22px;border-radius:11px;background:#fff;position:absolute;top:2px;${index % 2 === 0 ? "right:2px" : "left:2px"}"></div>
        </div>
      </div>`;

    case "avatar_row":
      return `<div style="display:flex;align-items:center;padding:16px 20px;gap:14px;background:${c.cardBg};border-radius:14px;margin:8px 20px">
        <div style="width:44px;height:44px;border-radius:22px;background:${c.primary};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px">${esc(el.text.charAt(0).toUpperCase())}</div>
        <div>
          <div style="font-size:15px;font-weight:600;color:${c.text}">${esc(el.text)}</div>
          ${el.secondary_text ? `<div style="font-size:12px;color:${c.muted}">${esc(el.secondary_text)}</div>` : ""}
        </div>
      </div>`;

    case "chip_row": {
      // Phase v0.3.0 — caption typography, chip shape token, separator border.
      // Pipe-separated takes precedence (newer screen_ui shape); falls back to
      // comma-split for older briefs.
      const raw = el.text || "";
      const chips = (raw.includes("|") ? raw.split("|") : raw.split(","))
        .map(s => s.trim()).filter(Boolean);
      const tc = profile.type_ramp.caption;
      const radius = profile.shape.chip;
      const padX = profile.spacing[2] ?? 14;
      const padY = profile.spacing[1] ?? 6;
      return `<div style="display:flex;gap:8px;padding:8px 20px;flex-wrap:wrap">
        ${chips.map((chip, ci) => `<span style="padding:${padY}px ${padX}px;border-radius:${radius}px;font-size:${tc.size}px;font-weight:${tc.weight};${ci === 0 ? `background:${c.primary};color:#fff` : `background:${c.cardBg};color:${c.text};border:1px solid ${c.border}`}">${esc(chip)}</span>`).join("")}
      </div>`;
    }

    case "divider":
      return el.text
        ? `<div style="padding:16px 20px 6px;font-size:11px;font-weight:600;color:${c.muted};text-transform:uppercase;letter-spacing:0.5px">${esc(el.text)}</div>`
        : `<div style="border-top:1px solid ${c.border};margin:8px 20px"></div>`;

    case "image_placeholder":
      return `<div style="margin:8px 20px;height:160px;border-radius:14px;background:${c.primary}10;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px">
        <span style="font-size:32px">${esc(el.icon) || "🖼"}</span>
        ${el.text ? `<span style="font-size:12px;color:${c.muted}">${esc(el.text)}</span>` : ""}
      </div>`;

    case "bottom_nav":
      return ""; // Rendered separately

    default:
      return `<div style="padding:8px 20px;font-size:14px;color:${c.text}">${esc(el.text)}</div>`;
  }
}

// Lucide-derived SVG icons in two variants: line (inactive) + filled (active).
// Single icon family eliminates the emoji-mix amateur tell flagged by 2026 research.
// 24×24 viewport, stroke-width 2 for line, fill for active.
const NAV_ICONS: Record<string, { line: string; filled: string }> = {
  home: {
    line: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>',
    filled: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  },
  tools: {
    line: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>',
    filled: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  },
  history: {
    line: '<rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    filled: '<rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor"/><path d="M9 8h6M9 12h6M9 16h4" stroke="white" stroke-width="2" stroke-linecap="round"/>',
  },
  reference: {
    line: '<path d="M4 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M12 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>',
    filled: '<path d="M4 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M12 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>',
  },
  settings: {
    line: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>',
    filled: '<circle cx="12" cy="12" r="3" fill="white"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="currentColor"/>',
  },
  search: {
    line: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    filled: '<circle cx="11" cy="11" r="7" fill="currentColor"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  },
  profile: {
    line: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
    filled: '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21a8 8 0 0 1 16 0" fill="currentColor"/>',
  },
  add: {
    line: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    filled: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 8v8M8 12h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>',
  },
  default: {
    line: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>',
    filled: '<circle cx="12" cy="12" r="9" fill="currentColor"/>',
  },
};

function pickIcon(label: string): { line: string; filled: string } {
  const k = label.toLowerCase().trim();
  if (k.includes("home")) return NAV_ICONS.home;
  if (k.includes("tool") || k.includes("calc")) return NAV_ICONS.tools;
  if (k.includes("histor") || k.includes("recent") || k.includes("saved")) return NAV_ICONS.history;
  if (k.includes("ref") || k.includes("learn") || k.includes("doc") || k.includes("guide")) return NAV_ICONS.reference;
  if (k.includes("setting") || k.includes("config") || k.includes("more") || k.includes("menu")) return NAV_ICONS.settings;
  if (k.includes("search") || k.includes("find") || k.includes("browse")) return NAV_ICONS.search;
  if (k.includes("profile") || k.includes("account") || k.includes("user")) return NAV_ICONS.profile;
  if (k.includes("add") || k.includes("new") || k.includes("create")) return NAV_ICONS.add;
  return NAV_ICONS.default;
}

function navIconSvg(label: string, active: boolean, color: string): string {
  const icon = pickIcon(label);
  const path = active ? icon.filled : icon.line;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="color:${color};display:block">${path}</svg>`;
}

function renderBottomNav(el: ScreenUIElement | undefined, c: ReturnType<typeof getColors>, activeIndex: number, profile: StyleProfile): string {
  // Phase v0.3.0 — pipe-separated takes precedence over comma-split (newer
  // screen_ui shape). Height + label typography from profile tokens.
  const raw = el?.text || "";
  const tabs = raw
    ? (raw.includes("|") ? raw.split("|") : raw.split(",")).map(s => s.trim()).filter(Boolean)
    : ["Home", "Tools", "History", "Reference", "Settings"];
  const tabBarH = profile.density.tab_bar_height;
  const tc = profile.type_ramp.caption;
  const labelSize = Math.max(10, Math.min(tc.size, 12));

  return `<div style="position:fixed;bottom:0;left:0;right:0;height:${tabBarH}px;background:${c.cardBg};border-top:1px solid ${c.border};display:flex;align-items:stretch;justify-content:space-around;padding:8px 4px 12px;backdrop-filter:blur(20px);box-shadow:0 -2px 12px rgba(0,0,0,0.04)">
    ${tabs.map((tab, i) => {
      const active = i === activeIndex;
      const color = active ? c.primary : c.muted;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
        ${navIconSvg(tab, active, color)}
        <span style="font-size:${labelSize}px;font-weight:${active ? 700 : tc.weight};color:${color};letter-spacing:0.2px">${esc(tab)}</span>
      </div>`;
    }).join("")}
  </div>`;
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  const body: RenderRequest = await request.json();
  const { screen_ui, app_name, primary_color, accent_color, is_dark, style_profile } = body;
  // Phase v0.3.0 — fill missing profile fields so element renderers can read
  // any token without null-checking.
  const profile = profileOrDefault(style_profile);
  const c = getColors(primary_color || "#4f46e5", accent_color || "#7c3aed", is_dark ?? false, profile);
  const ctx: RenderCtx = { c, profile };

  // Build elements HTML — skip status_bar (rendered in template) and bottom_nav (rendered separately)
  let statCardIndex = 0;
  const elementsHtml = screen_ui.elements
    .filter(el => el.element_type !== "bottom_nav" && el.element_type !== "status_bar")
    .map((el, i) => {
      if (el.element_type === "stat_card") {
        return renderElement(el, ctx, statCardIndex++);
      }
      return renderElement(el, ctx, i);
    })
    .join("\n");

  // Bottom nav
  const bottomNavEl = screen_ui.elements.find(e => e.element_type === "bottom_nav");
  const bottomNavHtml = screen_ui.has_bottom_nav
    ? renderBottomNav(bottomNavEl, c, screen_ui.active_tab_index, profile)
    : "";

  // Phase v0.3.0 — body chrome derives from the profile.
  // - body font-family from type_ramp.body.family (with iOS+Android fallback)
  // - page background from "page_bg" gradient if present, else flat color
  // - bottom-nav padding from density.tab_bar_height
  const fontStack = resolveFontStack(profile.type_ramp.body.family);
  const pageBg = profile.gradients.find(g => g.name === "page_bg")
    ? gradientCss(profile, "page_bg", c.bg, c.bg)
    : c.bg;
  const tabBarH = profile.density.tab_bar_height;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 390px;
    height: 844px;
    overflow: hidden;
    background: ${pageBg};
    font-family: ${fontStack};
    -webkit-font-smoothing: antialiased;
    color: ${c.text};
  }
  .screen {
    width: 390px;
    height: 844px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: ${screen_ui.has_bottom_nav ? `${tabBarH + 4}px` : "20px"};
  }
</style>
</head>
<body>
<div class="screen">
  <!-- Status bar -->
  <div style="display:flex;justify-content:space-between;padding:14px 20px 8px;font-size:13px;font-weight:600;color:${c.text}">
    <span>9:41</span>
    <div style="display:flex;gap:4px;align-items:center">
      <span style="font-size:11px">●●●●</span>
      <span style="font-size:11px">WiFi</span>
      <span style="font-size:11px">▐</span>
    </div>
  </div>
  ${elementsHtml}
</div>
${bottomNavHtml}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
