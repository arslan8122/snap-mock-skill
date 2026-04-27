import Konva from "konva";
import type {
  BackgroundLayer,
  TextLayer,
  DeviceLayer,
  ShapeLayer,
  IconLayer,
  Screenshot,
} from "@/stores/mockupStore";
import { getDeviceById } from "@/data/deviceFrames";
import { generateMeshGradient } from "@/lib/meshGradient";

/**
 * Renders a single screenshot's layers onto an offscreen Konva Stage
 * and returns the data URL. Mirrors MockupCanvas rendering exactly.
 */
export function renderScreenshotToDataUrl(
  screenshot: Screenshot,
  canvasW: number,
  canvasH: number,
  pixelRatio: number = 1,
): Promise<string> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    document.body.appendChild(container);
    const stage = new Konva.Stage({ container, width: canvasW, height: canvasH });
    const layer = new Konva.Layer();
    stage.add(layer);

    // Clip group — mirrors ScreenshotGroup clipFunc
    const clipGroup = new Konva.Group({
      clipFunc: (ctx) => {
        ctx.rect(0, 0, canvasW, canvasH);
      },
    });
    layer.add(clipGroup);

    const imagePromises: Promise<void>[] = [];

    for (const l of screenshot.layers) {
      if (!l.visible) continue;

      // --- Background ---
      if (l.type === "background") {
        const bg = l as BackgroundLayer;
        const bgType = bg.backgroundType || (bg.useGradient ? "linear" : "solid");

        if (bgType === "mesh" && bg.meshColors?.length) {
          // Mesh gradient — render on offscreen canvas, load as image.
          // Panoramic mode: same seed + sequential slot index = blobs stitch across slot boundaries.
          const meshDataUrl = generateMeshGradient(
            canvasW,
            canvasH,
            bg.meshColors,
            bg.meshSeed || 0,
            bg.panoramicSlot,
            bg.panoramicTotal ?? 6,
          );
          // Pull seed/colors so aurora & vignette are stable per slot
          const seed = bg.meshSeed || 0;
          const accent = bg.meshColors[bg.meshColors.length - 1] || "#ffffff";
          imagePromises.push(
            new Promise<void>((res) => {
              const img = new window.Image();
              img.onload = () => {
                const konvaImg = new Konva.Image({ image: img, x: 0, y: 0, width: canvasW, height: canvasH, opacity: bg.opacity });
                clipGroup.add(konvaImg);
                konvaImg.moveToBottom();

                // --- Aurora overlay: 2 large radial-gradient blobs in accent color, very soft ---
                // Pseudo-random but seed-stable position per slot
                const r1x = (seed * 137) % canvasW;
                const r1y = (seed * 211) % (canvasH * 0.6);
                const r2x = ((seed * 89) + canvasW * 0.5) % canvasW;
                const r2y = ((seed * 173) + canvasH * 0.4) % canvasH;
                const blobR = canvasW * 0.7;
                const aurora1 = new Konva.Circle({
                  x: r1x, y: r1y, radius: blobR,
                  fillRadialGradientStartPoint: { x: 0, y: 0 },
                  fillRadialGradientEndPoint: { x: 0, y: 0 },
                  fillRadialGradientStartRadius: 0,
                  fillRadialGradientEndRadius: blobR,
                  fillRadialGradientColorStops: [0, `${accent}55`, 0.5, `${accent}22`, 1, `${accent}00`],
                  listening: false,
                });
                const aurora2 = new Konva.Circle({
                  x: r2x, y: r2y, radius: blobR * 0.85,
                  fillRadialGradientStartPoint: { x: 0, y: 0 },
                  fillRadialGradientEndPoint: { x: 0, y: 0 },
                  fillRadialGradientStartRadius: 0,
                  fillRadialGradientEndRadius: blobR * 0.85,
                  fillRadialGradientColorStops: [0, `${bg.meshColors[0]}66`, 0.6, `${bg.meshColors[0]}11`, 1, `${bg.meshColors[0]}00`],
                  listening: false,
                });
                clipGroup.add(aurora1);
                clipGroup.add(aurora2);
                aurora1.zIndex(1);
                aurora2.zIndex(2);

                // --- Edge vignette: dark radial darkening from corners inward ---
                const vignette = new Konva.Rect({
                  x: 0, y: 0, width: canvasW, height: canvasH,
                  fillRadialGradientStartPoint: { x: canvasW / 2, y: canvasH / 2 },
                  fillRadialGradientEndPoint: { x: canvasW / 2, y: canvasH / 2 },
                  fillRadialGradientStartRadius: canvasW * 0.35,
                  fillRadialGradientEndRadius: Math.max(canvasW, canvasH) * 0.7,
                  fillRadialGradientColorStops: [0, "rgba(0,0,0,0)", 0.7, "rgba(0,0,0,0.15)", 1, "rgba(0,0,0,0.35)"],
                  listening: false,
                });
                clipGroup.add(vignette);
                vignette.zIndex(3);

                res();
              };
              img.onerror = () => {
                clipGroup.add(new Konva.Rect({ x: 0, y: 0, width: canvasW, height: canvasH, fill: bg.fill, opacity: bg.opacity }));
                res();
              };
              img.src = meshDataUrl;
            })
          );
        } else if (bgType === "image" && bg.imageUrl) {
          imagePromises.push(
            new Promise<void>((res) => {
              const img = new window.Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                const grp = new Konva.Group({ opacity: bg.opacity });
                grp.add(new Konva.Image({ image: img, x: 0, y: 0, width: canvasW, height: canvasH }));
                const ov = bg.overlayOpacity ?? 0.4;
                grp.add(new Konva.Rect({
                  x: 0, y: 0, width: canvasW, height: canvasH,
                  fillLinearGradientStartPoint: { x: 0, y: 0 },
                  fillLinearGradientEndPoint: { x: 0, y: canvasH },
                  fillLinearGradientColorStops: [0, `rgba(0,0,0,${ov * 0.5})`, 0.4, `rgba(0,0,0,${ov * 0.7})`, 1, `rgba(0,0,0,${ov})`],
                }));
                clipGroup.add(grp);
                grp.moveToBottom();
                res();
              };
              img.onerror = () => {
                clipGroup.add(new Konva.Rect({ x: 0, y: 0, width: canvasW, height: canvasH, fill: bg.fill, opacity: bg.opacity }));
                res();
              };
              img.src = bg.imageUrl!;
            })
          );
        } else if (bgType === "linear" && bg.gradientStart && bg.gradientEnd) {
          const angle = (bg.gradientAngle || 0) * (Math.PI / 180);
          const cx = canvasW / 2, cy = canvasH / 2, len = Math.max(canvasW, canvasH);
          clipGroup.add(new Konva.Rect({
            x: 0, y: 0, width: canvasW, height: canvasH, opacity: bg.opacity,
            fillLinearGradientStartPoint: { x: cx - Math.cos(angle) * len, y: cy - Math.sin(angle) * len },
            fillLinearGradientEndPoint: { x: cx + Math.cos(angle) * len, y: cy + Math.sin(angle) * len },
            fillLinearGradientColorStops: [0, bg.gradientStart, 1, bg.gradientEnd],
          }));
        } else {
          clipGroup.add(new Konva.Rect({ x: 0, y: 0, width: canvasW, height: canvasH, fill: bg.fill, opacity: bg.opacity }));
        }
      }

      // --- Device ---
      if (l.type === "device") {
        const dl = l as DeviceLayer;
        const device = getDeviceById(dl.deviceId);
        const getBezelFill = () => {
          if (dl.frameStyle === "color") return dl.frameColor;
          if (dl.frameStyle === "clay") return "#e8e8e8";
          return device.bezelColor;
        };
        const cornerRadius = device.screenRadius + 6;
        const group = new Konva.Group({ x: dl.x, y: dl.y, scaleX: dl.scale, scaleY: dl.scale, rotation: dl.rotation, opacity: dl.opacity });

        // Shadows — pro-grade depth per 2026 Play Store research:
        //   ambient: y=12 blur=40 alpha=0.18 (soft surrounding)
        //   key:     y=40 blur=100 alpha=0.25 (long projected shadow grounding the device)
        group.add(new Konva.Rect({ width: device.frameWidth, height: device.frameHeight, fill: "transparent", cornerRadius, shadowColor: "rgba(0,0,0,0.18)", shadowBlur: 40, shadowOffsetY: 12, perfectDrawEnabled: false }));
        group.add(new Konva.Rect({ width: device.frameWidth, height: device.frameHeight, fill: "transparent", cornerRadius, shadowColor: "rgba(0,0,0,0.25)", shadowBlur: 100, shadowOffsetY: 40, perfectDrawEnabled: false }));
        // Bezel
        group.add(new Konva.Rect({ width: device.frameWidth, height: device.frameHeight, fill: getBezelFill(), cornerRadius }));
        // Screen
        group.add(new Konva.Rect({ x: device.screenX, y: device.screenY, width: device.screenWidth, height: device.screenHeight, fill: dl.frameStyle === "clay" ? "#f0f0f0" : "#1a1a1a", cornerRadius: device.screenRadius }));

        if (dl.screenshotUrl) {
          imagePromises.push(
            new Promise<void>((res) => {
              const img = new window.Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                // Clip the screenshot to the device's screen-rounded-rect so it
                // doesn't overflow the curved corners of the bezel.
                const sx = device.screenX;
                const sy = device.screenY;
                const sw = device.screenWidth;
                const sh = device.screenHeight;
                const sr = device.screenRadius;
                const screenClipGroup = new Konva.Group({
                  clipFunc: (ctx) => {
                    ctx.beginPath();
                    ctx.moveTo(sx + sr, sy);
                    ctx.lineTo(sx + sw - sr, sy);
                    ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + sr);
                    ctx.lineTo(sx + sw, sy + sh - sr);
                    ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - sr, sy + sh);
                    ctx.lineTo(sx + sr, sy + sh);
                    ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - sr);
                    ctx.lineTo(sx, sy + sr);
                    ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
                    ctx.closePath();
                  },
                });
                screenClipGroup.add(new Konva.Image({ image: img, x: sx, y: sy, width: sw, height: sh }));
                group.add(screenClipGroup);
                res();
              };
              img.onerror = () => res();
              img.src = dl.screenshotUrl!;
            })
          );
        }
        clipGroup.add(group);
      }

      // --- Text ---
      if (l.type === "text") {
        const tl = l as TextLayer;
        const fontStyle = tl.fontWeight === "normal" || tl.fontWeight === "400" ? "normal" : tl.fontWeight === "bold" || tl.fontWeight === "700" ? "bold" : tl.fontWeight;
        // Drop shadow
        clipGroup.add(new Konva.Text({ x: tl.x + 1, y: tl.y + 1, width: tl.width, text: tl.text, fontSize: tl.fontSize, fontFamily: tl.fontFamily, fontStyle, fill: "rgba(0,0,0,0.2)", align: tl.align, rotation: tl.rotation, lineHeight: 1.2 }));
        // Main text
        clipGroup.add(new Konva.Text({ x: tl.x, y: tl.y, width: tl.width, text: tl.text, fontSize: tl.fontSize, fontFamily: tl.fontFamily, fontStyle, fill: tl.fill, align: tl.align, rotation: tl.rotation, opacity: tl.opacity, lineHeight: 1.2 }));
      }

      // --- Shape ---
      if (l.type === "shape") {
        const sl = l as ShapeLayer;
        if (sl.shapeType === "circle") {
          clipGroup.add(new Konva.Circle({ x: sl.x + sl.width / 2, y: sl.y + sl.height / 2, radius: sl.width / 2, fill: sl.fill, rotation: sl.rotation, opacity: sl.opacity, shadowColor: sl.fill, shadowBlur: sl.cornerRadius || 0 }));
        } else {
          clipGroup.add(new Konva.Rect({ x: sl.x, y: sl.y, width: sl.width, height: sl.height, fill: sl.fill, cornerRadius: sl.cornerRadius, rotation: sl.rotation, opacity: sl.opacity, shadowColor: sl.fill, shadowBlur: sl.cornerRadius || 0 }));
        }
      }

      // --- Icon ---
      if (l.type === "icon") {
        const il = l as IconLayer;
        if (il.imageUrl) {
          imagePromises.push(
            new Promise<void>((res) => {
              const img = new window.Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                if (il.cornerRadius > 0) {
                  const iconGroup = new Konva.Group({
                    clipFunc: (ctx) => {
                      const r = il.cornerRadius;
                      ctx.beginPath();
                      ctx.moveTo(il.x + r, il.y);
                      ctx.lineTo(il.x + il.width - r, il.y);
                      ctx.quadraticCurveTo(il.x + il.width, il.y, il.x + il.width, il.y + r);
                      ctx.lineTo(il.x + il.width, il.y + il.height - r);
                      ctx.quadraticCurveTo(il.x + il.width, il.y + il.height, il.x + il.width - r, il.y + il.height);
                      ctx.lineTo(il.x + r, il.y + il.height);
                      ctx.quadraticCurveTo(il.x, il.y + il.height, il.x, il.y + il.height - r);
                      ctx.lineTo(il.x, il.y + r);
                      ctx.quadraticCurveTo(il.x, il.y, il.x + r, il.y);
                      ctx.closePath();
                    },
                  });
                  iconGroup.add(new Konva.Image({ image: img, x: il.x, y: il.y, width: il.width, height: il.height, opacity: il.opacity }));
                  clipGroup.add(iconGroup);
                } else {
                  clipGroup.add(new Konva.Image({ image: img, x: il.x, y: il.y, width: il.width, height: il.height, opacity: il.opacity }));
                }
                res();
              };
              img.onerror = () => res();
              img.src = il.imageUrl!;
            })
          );
        }
      }
    }

    Promise.all(imagePromises).then(() => {
      layer.draw();
      const dataUrl = stage.toDataURL({ pixelRatio, mimeType: "image/png" });
      stage.destroy();
      document.body.removeChild(container);
      resolve(dataUrl);
    });
  });
}
