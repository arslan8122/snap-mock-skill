import { create } from "zustand";
import { immer } from "zustand/middleware/immer";


export type LayerType = "background" | "device" | "text" | "icon" | "shape";

export interface LayerBase {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface BackgroundLayer extends LayerBase {
  type: "background";
  fill: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientAngle?: number;
  useGradient: boolean;
  imageUrl?: string;
  backgroundType?: "solid" | "linear" | "mesh" | "image";
  meshColors?: string[];
  meshSeed?: number;
  overlayOpacity?: number; // dark overlay for image backgrounds (0-1)
  // Panoramic mode: when set, the mesh blobs are generated as if the canvas
  // were `panoramicTotal` widths wide, and this slot's window is cropped out.
  // All slots in a set share the same meshSeed so blobs stitch across boundaries.
  panoramicSlot?: number;
  panoramicTotal?: number;
}

export interface DeviceLayer extends LayerBase {
  type: "device";
  deviceId: string;
  screenshotUrl?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  frameStyle: "real" | "clay" | "color";
  frameColor: string;
}

export interface TextLayer extends LayerBase {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  align: "left" | "center" | "right";
  x: number;
  y: number;
  width: number;
  rotation: number;
}

export interface IconLayer extends LayerBase {
  type: "icon";
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

export interface ShapeLayer extends LayerBase {
  type: "shape";
  shapeType: "rect" | "circle" | "star";
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  rotation: number;
}

export type Layer = BackgroundLayer | DeviceLayer | TextLayer | IconLayer | ShapeLayer;

export interface Screenshot {
  id: string;
  name: string;
  layers: Layer[];
}

export interface MockupProject {
  id: string;
  name: string;
  screenshots: Screenshot[];
  activeScreenshotId: string;
  canvasWidth: number;
  canvasHeight: number;
}

// Phase v0.3.0 — minimal StyleProfile shape, kept here to avoid a circular
// import between the store and loadBriefs.ts. Full schema (with all keys
// required) lives in loadBriefs.ts as `StyleProfile`. This loose shape is what
// the renderer reads.
export interface StyleProfileShape {
  type_ramp: {
    display: { size: number; weight: string; family: string; letter_spacing?: number };
    title:   { size: number; weight: string; family: string; letter_spacing?: number };
    body:    { size: number; weight: string; family: string; letter_spacing?: number };
    caption: { size: number; weight: string; family: string; letter_spacing?: number };
  };
  colors: {
    primary: string; secondary: string | null; accent: string;
    background: string; surface: string;
    label_primary: string; label_secondary: string; separator: string;
  };
  gradients: Array<{ name: string; colors: string[]; angle: number }>;
  spacing: number[];
  shape: { card: number; button: number; input: number; chip: number; sheet: number };
  density: { list_row_height: number; button_height: number; tab_bar_height: number; input_height: number };
  elevation: { card: number; button: number; modal: number; sheet: number };
  mood_modifiers: {
    uppercase_buttons: boolean;
    letter_spaced_titles: boolean;
    text_shadows: boolean;
    bold_outlines: boolean;
    drop_caps: boolean;
  };
}

interface MockupState {
  project: MockupProject;
  selectedLayerId: string | null;
  history: MockupProject[];
  historyIndex: number;
  zoom: number;
  // Phase FG: standalone landscape banner (1024×500). Lives outside `project.screenshots`
  // so it never gets clobbered when the user adds/removes/reorders the 6 slot screenshots.
  featureGraphic: Screenshot | null;
  // Phase v0.3.0 — extracted from target app source by Claude during synthesis.
  // Renderer reads this for every fontSize, padding, color, corner_radius. Null
  // until BriefsBootstrapper hydrates it; renderer falls back to defaults.
  styleProfile: StyleProfileShape | null;

  setProject: (project: MockupProject) => void;
  selectLayer: (layerId: string | null) => void;
  addLayer: (screenshotId: string, layer: Layer) => void;
  updateLayer: (screenshotId: string, layerId: string, updates: Partial<Layer>) => void;
  removeLayer: (screenshotId: string, layerId: string) => void;
  reorderLayers: (screenshotId: string, fromIndex: number, toIndex: number) => void;
  toggleLayerVisibility: (screenshotId: string, layerId: string) => void;
  setActiveScreenshot: (screenshotId: string) => void;
  addScreenshot: () => void;
  removeScreenshot: (screenshotId: string) => void;
  duplicateScreenshot: (screenshotId: string) => void;
  setZoom: (zoom: number) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  loadTemplate: (template: { name: string; screenshots: Screenshot[]; featureGraphic?: Screenshot | null; styleProfile?: StyleProfileShape | null }) => void;
  setFeatureGraphic: (fg: Screenshot | null) => void;
  setStyleProfile: (profile: StyleProfileShape | null) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const createDefaultBackground = (): BackgroundLayer => ({
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

const createDefaultScreenshot = (name: string): Screenshot => ({
  id: generateId(),
  name,
  layers: [createDefaultBackground()],
});

const createDefaultProject = (): MockupProject => {
  const firstScreenshot = createDefaultScreenshot("Screenshot 1");
  return {
    id: generateId(),
    name: "Untitled Project",
    screenshots: [firstScreenshot],
    activeScreenshotId: firstScreenshot.id,
    canvasWidth: 390,
    canvasHeight: 844,
  };
};

export const useMockupStore = create<MockupState>()(
  immer((set) => ({
    project: createDefaultProject(),
    selectedLayerId: null,
    history: [],
    historyIndex: -1,
    zoom: 0.65,
    featureGraphic: null,
    styleProfile: null,

    setProject: (project) =>
      set((state) => {
        state.project = project;
      }),

    setFeatureGraphic: (fg) =>
      set((state) => {
        state.featureGraphic = fg;
      }),

    setStyleProfile: (profile) =>
      set((state) => {
        state.styleProfile = profile;
      }),

    selectLayer: (layerId) =>
      set((state) => {
        state.selectedLayerId = layerId;
      }),

    addLayer: (screenshotId, layer) =>
      set((state) => {
        const ss = state.project.screenshots.find((s) => s.id === screenshotId);
        if (ss) {
          ss.layers.push(layer);
          state.selectedLayerId = layer.id;
        }
      }),

    updateLayer: (screenshotId, layerId, updates) =>
      set((state) => {
        const ss = state.project.screenshots.find((s) => s.id === screenshotId);
        if (ss) {
          const layer = ss.layers.find((l) => l.id === layerId);
          if (layer) {
            Object.assign(layer, updates);
          }
        }
      }),

    removeLayer: (screenshotId, layerId) =>
      set((state) => {
        const ss = state.project.screenshots.find((s) => s.id === screenshotId);
        if (ss) {
          ss.layers = ss.layers.filter((l) => l.id !== layerId);
          if (state.selectedLayerId === layerId) {
            state.selectedLayerId = null;
          }
        }
      }),

    reorderLayers: (screenshotId, fromIndex, toIndex) =>
      set((state) => {
        const ss = state.project.screenshots.find((s) => s.id === screenshotId);
        if (ss) {
          const [moved] = ss.layers.splice(fromIndex, 1);
          ss.layers.splice(toIndex, 0, moved);
        }
      }),

    toggleLayerVisibility: (screenshotId, layerId) =>
      set((state) => {
        const ss = state.project.screenshots.find((s) => s.id === screenshotId);
        if (ss) {
          const layer = ss.layers.find((l) => l.id === layerId);
          if (layer) layer.visible = !layer.visible;
        }
      }),

    setActiveScreenshot: (screenshotId) =>
      set((state) => {
        state.project.activeScreenshotId = screenshotId;
        state.selectedLayerId = null;
      }),

    addScreenshot: () =>
      set((state) => {
        const num = state.project.screenshots.length + 1;
        const ss = createDefaultScreenshot(`Screenshot ${num}`);
        state.project.screenshots.push(ss);
        state.project.activeScreenshotId = ss.id;
      }),

    removeScreenshot: (screenshotId) =>
      set((state) => {
        if (state.project.screenshots.length <= 1) return;
        state.project.screenshots = state.project.screenshots.filter(
          (s) => s.id !== screenshotId
        );
        if (state.project.activeScreenshotId === screenshotId) {
          state.project.activeScreenshotId = state.project.screenshots[0].id;
        }
      }),

    duplicateScreenshot: (screenshotId) =>
      set((state) => {
        const ss = state.project.screenshots.find((s) => s.id === screenshotId);
        if (ss) {
          const clone: Screenshot = JSON.parse(JSON.stringify(ss));
          clone.id = generateId();
          clone.name = `${ss.name} (Copy)`;
          clone.layers.forEach((l) => (l.id = generateId()));
          state.project.screenshots.push(clone);
          state.project.activeScreenshotId = clone.id;
        }
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = Math.max(0.1, Math.min(3, zoom));
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex -= 1;
          state.project = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
        }
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex += 1;
          state.project = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
        }
      }),

    pushHistory: () =>
      set((state) => {
        const snapshot = JSON.parse(JSON.stringify(state.project));
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(snapshot);
        if (state.history.length > 50) state.history.shift();
        state.historyIndex = state.history.length - 1;
      }),

    loadTemplate: (template) =>
      set((state) => {
        state.project.name = template.name;
        state.project.screenshots = template.screenshots;
        state.project.activeScreenshotId = template.screenshots[0]?.id || "";
        state.selectedLayerId = null;
        // Phase FG: only update featureGraphic when the caller explicitly passed a value
        // (including null to intentionally clear). Omitting the field preserves an existing FG,
        // which lets BriefsBootstrapper hydrate it after screenshots without a race.
        if (template.featureGraphic !== undefined) {
          state.featureGraphic = template.featureGraphic;
        }
        // Phase v0.3.0 — style profile follows the same opt-in pattern. Caller
        // omits the field to preserve an existing profile (so the bootstrapper
        // can hydrate it after screenshots without a race).
        if (template.styleProfile !== undefined) {
          state.styleProfile = template.styleProfile;
        }
      }),
  }))
);
