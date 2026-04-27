"use client";

import { useEffect, useRef } from "react";
import { useMockupStore } from "@/stores/mockupStore";
import { aiScreenshotsToStore, fetchBriefs, type DeviceScreenshotMap } from "@/lib/loadBriefs";

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
              .map((s) => ({ id: s.name, name: s.name, screen_ui: s.screen_ui })),
            app_name: briefs.appName || "App",
            primary_color: briefs.theme?.primary_gradient_start || briefs.theme?.accent_color || "#4f46e5",
            accent_color: briefs.theme?.accent_color || briefs.theme?.primary_gradient_end || "#7c3aed",
            is_dark: briefs.theme?.mood === "dark" || briefs.theme?.mood === "premium",
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

      // 3. Load into store
      loadTemplate({
        name: `Briefs ${briefs.generatedAt}`,
        screenshots,
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
