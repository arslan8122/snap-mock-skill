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
}

function getColors(primary: string, accent: string, isDark: boolean) {
  return {
    bg: isDark ? "#0F1117" : "#F5F5F7",
    cardBg: isDark ? "#1A1B23" : "#FFFFFF",
    text: isDark ? "#EEEEF0" : "#1A1A1A",
    muted: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)",
    primary,
    accent,
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
  };
}

function renderElement(el: ScreenUIElement, c: ReturnType<typeof getColors>, index: number): string {
  switch (el.element_type) {
    case "status_bar":
      return `<div style="display:flex;justify-content:space-between;padding:12px 20px 8px;font-size:13px;font-weight:600;color:${c.text}">
        <span>9:41</span><span>●●●● ▌</span>
      </div>`;

    case "nav_bar":
      return `<div style="padding:8px 20px 16px;display:flex;align-items:center;gap:12px">
        <span style="color:${c.primary};font-size:18px">‹</span>
        <span style="font-size:18px;font-weight:700;color:${c.text}">${esc(el.text)}</span>
      </div>`;

    case "search_bar":
      return `<div style="margin:4px 20px 12px;padding:10px 16px;background:${c.cardBg};border-radius:10px;display:flex;align-items:center;gap:8px">
        <span style="color:${c.muted};font-size:14px">🔍</span>
        <span style="color:${c.muted};font-size:14px">${esc(el.text) || "Search…"}</span>
      </div>`;

    case "hero_banner":
      return `<div style="margin:8px 20px;padding:24px;border-radius:16px;background:linear-gradient(135deg,${c.primary},${c.accent});color:#fff;position:relative;overflow:hidden">
        ${el.icon ? `<div style="font-size:28px;margin-bottom:8px">${esc(el.icon)}</div>` : ""}
        <div style="font-size:20px;font-weight:700;margin-bottom:6px">${esc(el.text)}</div>
        ${el.secondary_text ? `<div style="font-size:13px;opacity:0.85">${esc(el.secondary_text)}</div>` : ""}
        <div style="position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:60px;background:rgba(255,255,255,0.08)"></div>
      </div>`;

    case "list_item":
      return `<div style="display:flex;align-items:center;padding:14px 20px;gap:14px;border-bottom:1px solid ${c.border}">
        ${el.icon ? `<div style="width:36px;height:36px;border-radius:18px;background:${c.primary}15;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${esc(el.icon)}</div>` : ""}
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:500;color:${c.text}">${esc(el.text)}</div>
          ${el.secondary_text ? `<div style="font-size:12px;color:${c.muted};margin-top:2px">${esc(el.secondary_text)}</div>` : ""}
        </div>
        <span style="color:${c.muted};font-size:16px">›</span>
      </div>`;

    case "card":
      return `<div style="margin:8px 20px;padding:18px;border-radius:14px;background:${c.cardBg};border-left:4px solid ${c.primary};box-shadow:0 1px 3px rgba(0,0,0,0.06)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          ${el.icon ? `<span style="font-size:18px">${esc(el.icon)}</span>` : ""}
          <span style="font-size:16px;font-weight:600;color:${c.text}">${esc(el.text)}</span>
        </div>
        ${el.secondary_text ? `<div style="font-size:13px;color:${c.muted}">${esc(el.secondary_text)}</div>` : ""}
      </div>`;

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

    case "button":
      return `<div style="margin:12px 20px">
        <div style="padding:14px;border-radius:12px;background:linear-gradient(135deg,${c.primary},${c.accent});color:#fff;font-weight:600;font-size:15px;text-align:center">${esc(el.text)}</div>
      </div>`;

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
      const chips = el.text.split(",").map(s => s.trim()).filter(Boolean);
      return `<div style="display:flex;gap:8px;padding:8px 20px;flex-wrap:wrap">
        ${chips.map((chip, ci) => `<span style="padding:6px 14px;border-radius:16px;font-size:13px;${ci === 0 ? `background:${c.primary};color:#fff` : `background:${c.cardBg};color:${c.text};border:1px solid ${c.border}`}">${esc(chip)}</span>`).join("")}
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

function renderBottomNav(el: ScreenUIElement | undefined, c: ReturnType<typeof getColors>, activeIndex: number): string {
  const tabs = el?.text ? el.text.split(",").map(s => s.trim()) : ["Home", "Tools", "History", "Reference", "Settings"];

  return `<div style="position:fixed;bottom:0;left:0;right:0;height:72px;background:${c.cardBg};border-top:1px solid ${c.border};display:flex;align-items:stretch;justify-content:space-around;padding:8px 4px 12px;backdrop-filter:blur(20px);box-shadow:0 -2px 12px rgba(0,0,0,0.04)">
    ${tabs.map((tab, i) => {
      const active = i === activeIndex;
      const color = active ? c.primary : c.muted;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
        ${navIconSvg(tab, active, color)}
        <span style="font-size:10px;font-weight:${active ? 700 : 500};color:${color};letter-spacing:0.2px">${esc(tab)}</span>
      </div>`;
    }).join("")}
  </div>`;
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  const body: RenderRequest = await request.json();
  const { screen_ui, app_name, primary_color, accent_color, is_dark } = body;
  const c = getColors(primary_color || "#4f46e5", accent_color || "#7c3aed", is_dark ?? false);

  // Build elements HTML — skip status_bar (rendered in template) and bottom_nav (rendered separately)
  let statCardIndex = 0;
  const elementsHtml = screen_ui.elements
    .filter(el => el.element_type !== "bottom_nav" && el.element_type !== "status_bar")
    .map((el, i) => {
      if (el.element_type === "stat_card") {
        return renderElement(el, c, statCardIndex++);
      }
      return renderElement(el, c, i);
    })
    .join("\n");

  // Bottom nav
  const bottomNavEl = screen_ui.elements.find(e => e.element_type === "bottom_nav");
  const bottomNavHtml = screen_ui.has_bottom_nav
    ? renderBottomNav(bottomNavEl, c, screen_ui.active_tab_index)
    : "";

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
    background: ${c.bg};
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .screen {
    width: 390px;
    height: 844px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: ${screen_ui.has_bottom_nav ? "72px" : "20px"};
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
