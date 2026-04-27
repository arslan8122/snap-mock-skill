/**
 * Generates a mesh gradient by layering radial gradient blobs on an offscreen canvas.
 * Returns a data URL that can be loaded as a Konva.Image source.
 *
 * Panoramic mode: when `panoramicSlot` is provided (0..panoramicTotal-1), the
 * blobs are generated as if the canvas were `panoramicTotal` widths wide, then
 * the per-slot window is cropped out. With the same `seed` across all slots,
 * blobs that fall on slot boundaries stitch perfectly. This is the technique
 * 2026 Play Store research flags as the single biggest amateur-to-pro signal.
 */
export function generateMeshGradient(
  width: number,
  height: number,
  colors: string[],
  seed: number = 0,
  panoramicSlot?: number,
  panoramicTotal: number = 6,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Seeded pseudo-random for reproducible gradients
  const seededRandom = createSeededRandom(seed);

  // Fill base color — ensure hex prefix
  const baseColor = colors[0] || "#1a1a2e";
  ctx.fillStyle = baseColor.startsWith("#") || baseColor.startsWith("r") ? baseColor : `#${baseColor}`;
  ctx.fillRect(0, 0, width, height);

  const isPanoramic = panoramicSlot !== undefined && panoramicSlot >= 0;
  const virtualWidth = isPanoramic ? width * panoramicTotal : width;
  const slotXOffset = isPanoramic ? (panoramicSlot ?? 0) * width : 0;

  // Panoramic mode generates more blobs across the wider virtual canvas so each
  // slot still gets a few intersecting it. Without this scaling the cropped slot
  // would look sparse compared to the non-panoramic single-slot output.
  const blobCount = isPanoramic ? 6 * panoramicTotal : 6;
  for (let i = 0; i < blobCount; i++) {
    const vx = seededRandom() * virtualWidth;
    const vy = seededRandom() * height;
    const x = vx - slotXOffset; // crop to this slot's window
    const y = vy;
    const radius = Math.max(width, height) * (0.4 + seededRandom() * 0.4);
    // Skip blobs whose entire footprint is outside this slot
    if (x + radius < 0 || x - radius > width) continue;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    let color = colors[i % colors.length];
    if (color && !color.startsWith("#") && !color.startsWith("r")) color = `#${color}`;
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = "source-over";
  return canvas.toDataURL("image/png");
}

function createSeededRandom(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
