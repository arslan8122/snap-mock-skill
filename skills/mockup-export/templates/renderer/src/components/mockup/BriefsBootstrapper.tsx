"use client";

import { useEffect, useRef } from "react";
import { useMockupStore } from "@/stores/mockupStore";
import { aiScreenshotsToStore, aiFeatureGraphicToStore, fetchBriefs, type DeviceScreenshotMap, type BriefsFile } from "@/lib/loadBriefs";

// D2: resolve image_placeholder.asset_url paths against briefs.projectAssets.
// Walks elements[] looking for image_placeholder entries. When asset_url is:
//   - a data: URL → pass through unchanged
//   - a path that matches a project asset with a data_url → rewrite to that data_url
//   - anything else → drop the field so the renderer uses its emoji fallback
function resolveProjectAssets(screenUi: unknown, projectAssets?: BriefsFile["projectAssets"]): unknown {
  if (!screenUi || typeof screenUi !== "object") return screenUi;
  const ui = screenUi as { elements?: Array<Record<string, unknown>> };
  if (!Array.isArray(ui.elements)) return screenUi;
  const lookup = new Map<string, string>();
  for (const a of projectAssets || []) {
    if (a.path && a.data_url) lookup.set(a.path, a.data_url);
  }
  const elements = ui.elements.map((el) => {
    if (el?.element_type !== "image_placeholder") return el;
    const url = el.asset_url;
    if (typeof url !== "string" || url.length === 0) return el;
    if (url.startsWith("data:")) return el; // pass through
    const resolved = lookup.get(url);
    if (resolved) return { ...el, asset_url: resolved };
    // Path didn't resolve — drop the field so renderer falls back gracefully
    const { asset_url: _drop, ...rest } = el;
    return rest;
  });
  return { ...ui, elements };
}

export default function BriefsBootstrapper() {
  const loadTemplate = useMockupStore((s) => s.loadTemplate);
  const lastLoadedAt = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const briefs = await fetchBriefs();
      if (cancelled || !briefs) return;
      if (lastLoadedAt.current === briefs.generatedAt) return;

      // 1. Render device screens via the server-side Playwright route
      const deviceScreenshots: DeviceScreenshotMap = {};
      try {
        const renderRes = await fetch("/api/render-screen-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screens: briefs.screenshots
              .filter((s) => !!s.screen_ui)
              .map((s) => {
                // Match how the renderer treats DI: any device_id starting with iphone-1[5-9] OR explicitly *-pro/-pro-max.
                const firstDevice = (s.layers || []).find((l) => l.type === "device") as { device_id?: string } | undefined;
                const did = firstDevice?.device_id || "";
                const hasIsland = did === "iphone-16-pro" || did === "iphone-16-pro-max" || did === "iphone-15-pro";
                // Phase D: resolve image_placeholder.asset_url (project-asset path → data_url)
                // by looking the path up in briefs.projectAssets. Pass-through if it's already
                // a data: URL; drop the field if the path can't be resolved (renderer falls back
                // to the emoji placeholder).
                const resolvedScreenUi = resolveProjectAssets(s.screen_ui, briefs.projectAssets);
                return { id: s.name, name: s.name, screen_ui: resolvedScreenUi, has_dynamic_island: hasIsland };
              }),
            app_name: briefs.appName || "App",
            primary_color: briefs.theme?.primary_gradient_start || briefs.theme?.accent_color || "#4f46e5",
            accent_color: briefs.theme?.accent_color || briefs.theme?.primary_gradient_end || "#7c3aed",
            is_dark: briefs.theme?.mood === "dark" || briefs.theme?.mood === "premium",
            // Phase v0.3.0 — forward the extracted style profile so the
            // server-side render-screen route can use target-app fontSize,
            // padding, radius, gradients, etc. Falls back to defaults inside
            // the route when this is undefined.
            style_profile: briefs.style_profile,
          }),
        });
        if (renderRes.ok) {
          const { results } = (await renderRes.json()) as {
            results: Array<{ id: string; data_url: string | null; error: string | null }>;
          };
          for (const r of results) {
            if (r.data_url) deviceScreenshots[r.id] = r.data_url;
          }
        } else {
          console.warn("[bootstrapper] render-screen-image failed:", renderRes.status);
        }
      } catch (e) {
        console.warn("[bootstrapper] render-screen-image error:", e);
      }

      if (cancelled) return;

      // 2. Map AI layers -> Zustand layers, attaching device screenshots
      const screenshots = aiScreenshotsToStore(
        briefs.screenshots,
        briefs.appIconUrl,
        deviceScreenshots,
      );
      if (screenshots.length === 0) return;

      // 2b. Phase FG: Build the Feature Graphic. Reuses the same deviceScreenshots
      // map — its device layers reference a slot via `source_slot`. No extra
      // /api/render-screen-image call.
      const featureGraphic = aiFeatureGraphicToStore(
        briefs.featureGraphic,
        briefs.appIconUrl,
        deviceScreenshots,
      );

      // 3. Load into store. Phase v0.3.0 — style_profile from briefs hydrates
      // the styleProfile slot in the store; null falls through and the
      // renderer falls back to DEFAULT_STYLE_PROFILE.
      loadTemplate({
        name: `Briefs ${briefs.generatedAt}`,
        screenshots,
        featureGraphic,
        styleProfile: briefs.style_profile ?? null,
      });
      lastLoadedAt.current = briefs.generatedAt;

      // 4. Signal hydration to headless clients
      if (typeof document !== "undefined") {
        document.body.setAttribute("data-briefs-generated-at", briefs.generatedAt);
      }
    })();
    return () => { cancelled = true; };
  }, [loadTemplate]);

  return null;
}
