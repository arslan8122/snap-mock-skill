# Toolbar patch — add ZIP-export button to the existing EditorToolbar

The existing `ai-mockup-generator` already renders a Konva stage and has a toolbar with `Export PNG` / `Export All` buttons that download PNGs one at a time via `<a download>` clicks (subject to Chromium's ~2 MB anchor-download limit).

To make the app driveable headlessly by Playwright, add **one** new button that bundles all screenshots into a single ZIP and triggers one HTTP-response download.

## File to edit

`src/components/mockup/EditorToolbar.tsx`

## Add this handler near the existing `handleExportAll`

```tsx
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
  const res = await fetch("/api/export-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pngs }),
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
```

## Add this button to the toolbar render block

Place it next to the existing `Export PNG` button:

```tsx
<Button
  size="sm"
  variant="secondary"
  data-action="export-all-zip"
  className="h-7 text-xs gap-1.5"
  onClick={handleExportAllZip}
>
  <Download className="h-3.5 w-3.5" />Export ZIP
</Button>
```

The `data-action="export-all-zip"` attribute is **required** — `export-screenshots.mjs` clicks the button by that selector.
