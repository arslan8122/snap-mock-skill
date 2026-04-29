"use client";

import { useMockupStore } from "@/stores/mockupStore";
import { Download } from "lucide-react";

const EditorToolbar = () => {
  const project = useMockupStore((s) => s.project);
  const featureGraphic = useMockupStore((s) => s.featureGraphic);

  const handleExportAllZip = async () => {
    const { renderScreenshotToDataUrl } = await import("@/lib/renderScreenshot");
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }
    const pixelRatio = 1080 / project.canvasWidth;
    const pngs: string[] = [];
    for (const ss of project.screenshots) {
      const dataUrl = await renderScreenshotToDataUrl(ss, project.canvasWidth, project.canvasHeight, pixelRatio);
      pngs.push(dataUrl);
    }

    // Phase FG: render the 1024×500 banner via the same Konva path with a
    // landscape canvas (logical 512×250, pixelRatio 2 → 1024×500). Skip when
    // no feature graphic is in the store (graceful fallback during dev).
    let featureGraphicDataUrl: string | undefined;
    if (featureGraphic) {
      try {
        featureGraphicDataUrl = await renderScreenshotToDataUrl(featureGraphic, 512, 250, 2);
      } catch (e) {
        console.warn("[fg] render failed, exporting without feature graphic:", e);
      }
    }

    const res = await fetch("/api/export-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pngs, featureGraphic: featureGraphicDataUrl }),
    });
    if (!res.ok) {
      console.error("export-all failed", res.status, await res.text());
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mockups.zip";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex items-center justify-end px-3 py-2 border-b border-border bg-card">
      <button
        type="button"
        data-action="export-all-zip"
        onClick={handleExportAllZip}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Export ZIP
      </button>
    </div>
  );
};

export default EditorToolbar;
