"use client";

import { useEffect, useRef } from "react";
import { useMockupStore } from "@/stores/mockupStore";
import { aiScreenshotsToStore, fetchBriefs } from "@/lib/loadBriefs";

export default function BriefsBootstrapper() {
  const loadTemplate = useMockupStore((s) => s.loadTemplate);
  const lastLoadedAt = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const briefs = await fetchBriefs();
      if (cancelled || !briefs) return;
      if (lastLoadedAt.current === briefs.generatedAt) return;
      const screenshots = aiScreenshotsToStore(briefs.screenshots, briefs.appIconUrl);
      if (screenshots.length === 0) return;
      loadTemplate({
        name: `Briefs ${briefs.generatedAt}`,
        screenshots,
      });
      lastLoadedAt.current = briefs.generatedAt;
      // Surface generatedAt for headless clients to verify barrier match
      if (typeof document !== "undefined") {
        document.body.setAttribute("data-briefs-generated-at", briefs.generatedAt);
      }
    })();
    return () => { cancelled = true; };
  }, [loadTemplate]);

  return null;
}
