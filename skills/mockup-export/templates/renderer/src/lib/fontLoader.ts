import { useState, useEffect } from "react";
import { GOOGLE_FONT_SPECS } from "@/data/fontPairings";

let fontsLoadedGlobal = false;
let fontsLoadingPromise: Promise<void> | null = null;
const listeners: Array<() => void> = [];

function loadFonts(): Promise<void> {
  if (fontsLoadedGlobal) return Promise.resolve();
  if (fontsLoadingPromise) return fontsLoadingPromise;

  fontsLoadingPromise = new Promise<void>((resolve) => {
    // Dynamically import webfontloader to avoid SSR issues
    import("webfontloader").then((WebFont) => {
      WebFont.load({
        google: { families: GOOGLE_FONT_SPECS },
        active: () => {
          fontsLoadedGlobal = true;
          listeners.forEach((fn) => fn());
          listeners.length = 0;
          resolve();
        },
        inactive: () => {
          // Fonts failed but we still proceed — fallback fonts will be used
          fontsLoadedGlobal = true;
          listeners.forEach((fn) => fn());
          listeners.length = 0;
          resolve();
        },
      });
    });
  });

  return fontsLoadingPromise;
}

/**
 * React hook that returns true when all Google Fonts are loaded.
 * Gates canvas rendering to prevent fallback font rendering.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(fontsLoadedGlobal);

  useEffect(() => {
    if (fontsLoadedGlobal) {
      setReady(true);
      return;
    }
    const handler = () => setReady(true);
    listeners.push(handler);
    loadFonts();
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  return ready;
}
