import { NextRequest, NextResponse } from "next/server";

// Render a single screen_ui (or array of them) as a PNG data URL by
// fetching the HTML from /api/render-screen and screenshotting it via Playwright.
//
// Local dev only — Playwright requires `playwright install chromium` and
// won't run in serverless. For production use, the bootstrapper falls back
// to leaving the device screen empty.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScreenRenderRequest {
  screens: Array<{
    id: string;
    name: string;
    screen_ui: unknown;
  }>;
  app_name: string;
  primary_color: string;
  accent_color: string;
  is_dark: boolean;
  // Phase v0.3.0 — extracted by Claude in PASS 0.5; forwarded to /api/render-screen
  // so element renderers can read profile tokens. Optional for backwards compat.
  style_profile?: unknown;
}

interface ScreenRenderResult {
  id: string;
  data_url: string | null;
  error: string | null;
}

export async function POST(req: NextRequest) {
  let body: ScreenRenderRequest;
  try {
    body = (await req.json()) as ScreenRenderRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!Array.isArray(body.screens) || body.screens.length === 0) {
    return NextResponse.json({ error: "screens must be a non-empty array" }, { status: 400 });
  }

  // Lazy-load playwright so the route doesn't crash if it's missing
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (e) {
    return NextResponse.json({
      error: "playwright not installed — run `npx playwright install chromium`",
      details: String(e),
    }, { status: 500 });
  }

  // Fetch HTML for each screen_ui from the existing /api/render-screen route.
  // We're already inside the Next.js server, so use absolute URL to localhost.
  const origin = req.headers.get("origin") || `http://localhost:${process.env.PORT || 3000}`;
  const htmls: Array<{ id: string; html: string | null; error: string | null }> = [];
  for (const s of body.screens) {
    if (!s.screen_ui) {
      htmls.push({ id: s.id, html: null, error: "no screen_ui" });
      continue;
    }
    try {
      const r = await fetch(`${origin}/api/render-screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screen_ui: s.screen_ui,
          app_name: body.app_name,
          primary_color: body.primary_color,
          accent_color: body.accent_color,
          is_dark: body.is_dark,
          // Phase v0.3.0 — pass through to render-screen so its element
          // renderers can consume target-extracted style tokens.
          style_profile: body.style_profile,
        }),
      });
      if (!r.ok) {
        htmls.push({ id: s.id, html: null, error: `render-screen ${r.status}` });
        continue;
      }
      htmls.push({ id: s.id, html: await r.text(), error: null });
    } catch (e) {
      htmls.push({ id: s.id, html: null, error: String(e) });
    }
  }

  // Screenshot each HTML in a fresh Playwright context
  const browser = await chromium.launch({ headless: true });
  const results: ScreenRenderResult[] = [];
  try {
    for (const h of htmls) {
      if (!h.html) {
        results.push({ id: h.id, data_url: null, error: h.error });
        continue;
      }
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      });
      const page = await ctx.newPage();
      try {
        await page.setContent(h.html, { waitUntil: "networkidle", timeout: 8000 });
        await page.waitForTimeout(300);
        const buf = await page.screenshot({
          clip: { x: 0, y: 0, width: 390, height: 844 },
          type: "png",
        });
        results.push({
          id: h.id,
          data_url: `data:image/png;base64,${buf.toString("base64")}`,
          error: null,
        });
      } catch (e) {
        results.push({ id: h.id, data_url: null, error: String(e) });
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  return NextResponse.json({ results });
}
