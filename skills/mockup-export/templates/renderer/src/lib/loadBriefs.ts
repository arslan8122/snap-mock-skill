import type {
  Screenshot,
  Layer,
  BackgroundLayer,
  DeviceLayer,
  TextLayer,
  IconLayer,
  ShapeLayer,
} from "@/stores/mockupStore";

// AI / briefs.json layer schema (snake_case, matches Python backend output)
interface AIBackgroundLayer {
  type: "background";
  name: string;
  background_type: string;
  fill: string;
  gradient_start?: string | null;
  gradient_end?: string | null;
  gradient_angle?: number;
  mesh_colors?: string[] | null;
  mesh_seed?: number;
  image_query?: string | null;
  overlay_opacity?: number;
  panoramic_slot?: number;
  panoramic_total?: number;
}
interface AIDeviceLayer {
  type: "device";
  name: string;
  device_id: string;
  x: number; y: number;
  scale: number; rotation: number;
  frame_style: string; frame_color: string;
  // Phase FG: device on the Feature Graphic references one of the 6 screenshots
  // by name so the runtime reuses that slot's already-rendered screen image
  // without paying for another /api/render-screen-image call.
  source_slot?: string;
}
interface AITextLayer {
  type: "text";
  name: string;
  text: string;
  font_family: string; font_weight: string;
  font_size: number; fill: string;
  align: string;
  x: number; y: number;
  width: number; rotation: number;
  opacity: number;
}
interface AIShapeLayer {
  type: "shape";
  name: string;
  shape_type: string; fill: string;
  x: number; y: number;
  width: number; height: number;
  corner_radius: number; rotation: number;
  opacity: number;
}
interface AIIconLayer {
  type: "icon";
  name: string;
  x: number; y: number;
  width: number; height: number;
  corner_radius: number;
}
type AILayer = AIBackgroundLayer | AIDeviceLayer | AITextLayer | AIShapeLayer | AIIconLayer;

interface AIScreenshot {
  name: string;
  layers: AILayer[];
  screen_ui?: unknown;
}

// Phase FG: feature graphic — same layer schema, no screen_ui. Each device layer
// MUST carry a `source_slot` referencing one of the 6 screenshots by name.
export interface AIFeatureGraphic {
  name: string;
  layers: AILayer[];
}

export interface BriefsFile {
  version: number;
  generatedAt: string;
  theme?: {
    headline_font?: string;
    body_font?: string;
    headline_weight?: string;
    mood?: string;
    accent_color?: string;
    primary_gradient_start?: string;
    primary_gradient_end?: string;
    mesh_colors?: string[];
  };
  screenshots: AIScreenshot[];
  appIconUrl?: string;
  appName?: string;
  // Phase D: in-project assets — synthesizer copies analysis.project_assets here
  // so the bootstrapper can resolve asset_url paths inside screen_ui without a
  // second filesystem fetch. Each entry's data_url (when present) is the only
  // value the renderer ever reads — `path` is just the lookup key.
  projectAssets?: Array<{
    path: string;
    kind?: string;
    data_url?: string;
    width?: number;
    height?: number;
  }>;
  // Phase FG: optional landscape banner (1024×500) generated alongside the 6 slots
  featureGraphic?: AIFeatureGraphic;
}

export type DeviceScreenshotMap = Record<string, string>; // ai-screenshot-name -> data_url

const generateId = () => Math.random().toString(36).substring(2, 11);

// Shared layer-to-store mapper used by both aiScreenshotsToStore and
// aiFeatureGraphicToStore. Caller supplies:
//   - aiLayers: the AILayer[] to convert
//   - resolveDeviceUrl(aiLayer) → string|undefined: how the caller looks up the
//     in-device screen render for a given device layer. Screenshots use
//     deviceScreenshots[screenshotName]; FG uses deviceScreenshots[layer.source_slot].
//   - appIconUrl: shared across both
function aiLayersToStore(
  aiLayers: AILayer[],
  resolveDeviceUrl: (l: AIDeviceLayer) => string | undefined,
  appIconUrl?: string,
): Layer[] {
  const layers: Layer[] = [];
  for (const aiLayer of aiLayers) {
      switch (aiLayer.type) {
        case "background": {
          const bgType = aiLayer.background_type === "image" ? "mesh" : aiLayer.background_type;
          const bg: BackgroundLayer = {
            id: generateId(),
            type: "background",
            name: aiLayer.name || "Background",
            visible: true,
            locked: false,
            opacity: 1,
            fill: aiLayer.fill || "#1a1a2e",
            useGradient: bgType === "linear",
            gradientStart: aiLayer.gradient_start || undefined,
            gradientEnd: aiLayer.gradient_end || undefined,
            gradientAngle: aiLayer.gradient_angle ?? 135,
            backgroundType: bgType as "solid" | "linear" | "mesh",
            meshColors: aiLayer.mesh_colors || undefined,
            meshSeed: aiLayer.mesh_seed ?? 42,
            panoramicSlot: aiLayer.panoramic_slot,
            panoramicTotal: aiLayer.panoramic_total,
          };
          layers.push(bg);
          break;
        }
        case "device": {
          const dev: DeviceLayer = {
            id: generateId(),
            type: "device",
            name: aiLayer.name || "Device",
            visible: true,
            locked: false,
            opacity: 1,
            deviceId: aiLayer.device_id || "pixel-9-pro",
            screenshotUrl: resolveDeviceUrl(aiLayer) || undefined,
            x: aiLayer.x,
            y: aiLayer.y,
            scale: aiLayer.scale,
            rotation: aiLayer.rotation,
            frameStyle: (aiLayer.frame_style as "real" | "clay" | "color") || "clay",
            frameColor: aiLayer.frame_color || "#ffffff",
          };
          layers.push(dev);
          break;
        }
        case "text": {
          const txt: TextLayer = {
            id: generateId(),
            type: "text",
            name: aiLayer.name || "Text",
            visible: true,
            locked: false,
            opacity: aiLayer.opacity ?? 1,
            text: aiLayer.text,
            fontSize: aiLayer.font_size,
            fontFamily: aiLayer.font_family,
            fontWeight: aiLayer.font_weight || "400",
            fill: aiLayer.fill || "#ffffff",
            align: (aiLayer.align as "left" | "center" | "right") || "center",
            x: aiLayer.x,
            y: aiLayer.y,
            width: aiLayer.width,
            rotation: aiLayer.rotation ?? 0,
          };
          layers.push(txt);
          break;
        }
        case "shape": {
          const sh: ShapeLayer = {
            id: generateId(),
            type: "shape",
            name: aiLayer.name || "Shape",
            visible: true,
            locked: true,
            opacity: aiLayer.opacity ?? 0.12,
            shapeType: (aiLayer.shape_type as "rect" | "circle" | "star") || "circle",
            fill: aiLayer.fill,
            x: aiLayer.x,
            y: aiLayer.y,
            width: aiLayer.width,
            height: aiLayer.height,
            cornerRadius: aiLayer.corner_radius ?? 0,
            rotation: aiLayer.rotation ?? 0,
          };
          layers.push(sh);
          break;
        }
        case "icon": {
          if (appIconUrl) {
            const ic: IconLayer = {
              id: generateId(),
              type: "icon",
              name: aiLayer.name || "App Icon",
              visible: true,
              locked: false,
              opacity: 1,
              imageUrl: appIconUrl,
              x: aiLayer.x,
              y: aiLayer.y,
              width: aiLayer.width,
              height: aiLayer.height,
              cornerRadius: aiLayer.corner_radius ?? Math.round(aiLayer.width * 0.22),
            };
            layers.push(ic);
          }
          break;
        }
      }
  }
  if (layers.length === 0) {
    layers.push({
      id: generateId(),
      type: "background",
      name: "Background",
      visible: true,
      locked: false,
      opacity: 1,
      fill: "#1a1a2e",
      useGradient: true,
      gradientStart: "#667eea",
      gradientEnd: "#764ba2",
      gradientAngle: 135,
    });
  }
  return layers;
}

export function aiScreenshotsToStore(
  ai: AIScreenshot[],
  appIconUrl?: string,
  deviceScreenshots?: DeviceScreenshotMap
): Screenshot[] {
  return ai.map((aiSs, i) => {
    const deviceUrl = deviceScreenshots?.[aiSs.name];
    const layers = aiLayersToStore(
      aiSs.layers,
      // For screenshots, every device layer reuses the screenshot's own screen render.
      () => deviceUrl,
      appIconUrl,
    );
    return {
      id: generateId(),
      name: `Mockup ${i + 1} - ${aiSs.name}`,
      layers,
    };
  });
}

// Phase FG: convert the briefs.json featureGraphic block into a Screenshot-shaped
// object. Each device layer's `source_slot` points at one of the 6 screenshots by
// name; we look up the already-rendered screen image in the same deviceScreenshots
// map so no extra Playwright pass is needed.
export function aiFeatureGraphicToStore(
  ai: AIFeatureGraphic | undefined,
  appIconUrl?: string,
  deviceScreenshots?: DeviceScreenshotMap,
): Screenshot | null {
  if (!ai || !Array.isArray(ai.layers)) return null;
  const layers = aiLayersToStore(
    ai.layers,
    (l) => {
      const slot = l.source_slot;
      if (slot && deviceScreenshots) {
        const url = deviceScreenshots[slot];
        if (url) return url;
        if (typeof console !== "undefined") {
          console.warn(`[fg] source_slot "${slot}" did not match any screenshot name; falling back to first available device screen`);
        }
      }
      // Fallback: first non-empty entry in the map (so the FG still renders something).
      if (deviceScreenshots) {
        const firstUrl = Object.values(deviceScreenshots).find((v) => !!v);
        if (firstUrl) return firstUrl;
      }
      return undefined;
    },
    appIconUrl,
  );
  return {
    id: generateId(),
    name: ai.name || "Feature Graphic",
    layers,
  };
}

export async function fetchBriefs(): Promise<BriefsFile | null> {
  try {
    const res = await fetch("/briefs.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as BriefsFile;
    if (data?.version !== 1 || !Array.isArray(data?.screenshots)) return null;
    return data;
  } catch {
    return null;
  }
}
