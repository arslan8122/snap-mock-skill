"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Stage, Layer, Rect, Text, Group, Circle, Image as KonvaImage, Shape } from "react-konva";
import { useMockupStore } from "@/stores/mockupStore";
import type { BackgroundLayer, TextLayer, DeviceLayer, ShapeLayer, IconLayer } from "@/stores/mockupStore";
import { getDeviceById } from "@/data/deviceFrames";
import { generateMeshGradient } from "@/lib/meshGradient";
import { useFontsReady } from "@/lib/fontLoader";
import Konva from "konva";

const useLoadImage = (url: string | undefined) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) { setImage(null); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    return () => { img.onload = null; img.onerror = null; };
  }, [url]);
  return image;
};

const DeviceFrameRenderer = ({
  layer, isSelected, onSelect,
}: {
  layer: DeviceLayer; isSelected: boolean; onSelect: () => void;
}) => {
  const device = getDeviceById(layer.deviceId);
  const screenshot = useLoadImage(layer.screenshotUrl);
  const { project, updateLayer } = useMockupStore();

  const getBezelFill = () => {
    if (layer.frameStyle === "color") return layer.frameColor;
    if (layer.frameStyle === "clay") return "#e8e8e8";
    return device.bezelColor;
  };

  const cornerRadius = device.screenRadius + 6;

  return (
    <Group
      x={layer.x} y={layer.y}
      scaleX={layer.scale} scaleY={layer.scale}
      rotation={layer.rotation}
      draggable={!layer.locked}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => {
        updateLayer(project.activeScreenshotId, layer.id, { x: e.target.x(), y: e.target.y() });
      }}
      opacity={layer.opacity} visible={layer.visible}
    >
      {/* Ambient shadow — soft glow spread */}
      <Rect width={device.frameWidth} height={device.frameHeight} fill="transparent" cornerRadius={cornerRadius}
        shadowColor="rgba(0,0,0,0.15)" shadowBlur={40} shadowOffsetX={0} shadowOffsetY={8} listening={false} perfectDrawEnabled={false} />
      {/* Directional shadow — defined light source */}
      <Rect width={device.frameWidth} height={device.frameHeight} fill="transparent" cornerRadius={cornerRadius}
        shadowColor="rgba(0,0,0,0.25)" shadowBlur={20} shadowOffsetX={5} shadowOffsetY={15} listening={false} perfectDrawEnabled={false} />
      {/* Device bezel */}
      <Rect width={device.frameWidth} height={device.frameHeight} fill={getBezelFill()} cornerRadius={cornerRadius} />
      {/* Subtle bezel highlight for realism */}
      {layer.frameStyle === "real" && (
        <Rect x={1} y={1} width={device.frameWidth - 2} height={device.frameHeight - 2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} cornerRadius={device.screenRadius + 5} listening={false} />
      )}
      {layer.frameStyle === "clay" && (
        <Rect x={0} y={0} width={device.frameWidth} height={device.frameHeight * 0.5}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: device.frameHeight * 0.5 }}
          fillLinearGradientColorStops={[0, "rgba(255,255,255,0.15)", 1, "rgba(255,255,255,0)"]}
          cornerRadius={cornerRadius} listening={false} />
      )}
      {/* Dynamic Island */}
      {device.hasDynamicIsland && (
        <Rect x={device.frameWidth / 2 - 45} y={device.screenY + 8} width={90} height={24} fill="#000000" cornerRadius={12} listening={false} />
      )}
      {/* Screen area — clipped */}
      <Group
        clipFunc={(ctx: Konva.Context) => {
          ctx.beginPath();
          const r = device.screenRadius, x = device.screenX, y = device.screenY, w = device.screenWidth, h = device.screenHeight;
          ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
        }}
      >
        <Rect x={device.screenX} y={device.screenY} width={device.screenWidth} height={device.screenHeight} fill={layer.frameStyle === "clay" ? "#f0f0f0" : "#1a1a1a"} />
        {screenshot && <KonvaImage image={screenshot} x={device.screenX} y={device.screenY} width={device.screenWidth} height={device.screenHeight} />}
        {!screenshot && (
          <>
            <Rect x={device.screenX} y={device.screenY} width={device.screenWidth} height={device.screenHeight}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: device.screenHeight }}
              fillLinearGradientColorStops={[0, layer.frameStyle === "clay" ? "#f8f8f8" : "#2a2a3e", 1, layer.frameStyle === "clay" ? "#e8e8e8" : "#1a1a2e"]}
            />
            <Text x={device.screenX} y={device.screenY + device.screenHeight / 2 - 12} width={device.screenWidth} text="Drop screenshot here" fontSize={11} fill={layer.frameStyle === "clay" ? "#999" : "#555"} align="center" />
          </>
        )}
        {/* Screen reflection overlay */}
        <Shape
          sceneFunc={(ctx, shape) => {
            const gradient = ctx.createLinearGradient(0, 0, device.screenWidth, device.screenHeight);
            gradient.addColorStop(0, "rgba(255,255,255,0.10)");
            gradient.addColorStop(0.4, "rgba(255,255,255,0.02)");
            gradient.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(device.screenX, device.screenY, device.screenWidth, device.screenHeight);
            ctx.fillStrokeShape(shape);
          }}
          listening={false}
        />
      </Group>
      {/* Selection indicator */}
      {isSelected && <Rect width={device.frameWidth} height={device.frameHeight} stroke="#4f8cff" strokeWidth={2 / layer.scale} cornerRadius={cornerRadius} dash={[6, 3]} listening={false} />}
    </Group>
  );
};

const getFontStyle = (weight: string): string => {
  // Konva fontStyle accepts "normal", "bold", "italic", or numeric weights as strings
  if (weight === "normal" || weight === "400") return "normal";
  if (weight === "bold" || weight === "700") return "bold";
  // For 500, 600, 800 — use the numeric value directly (Konva passes it to canvas)
  if (["500", "600", "800"].includes(weight)) return weight;
  return weight === "bold" ? "bold" : "normal";
};

const TextLayerRenderer = ({
  layer, isSelected, onSelect,
}: {
  layer: TextLayer; isSelected: boolean; onSelect: () => void;
}) => {
  const { project, updateLayer } = useMockupStore();
  const fontStyle = getFontStyle(layer.fontWeight);
  return (
    <Group visible={layer.visible} opacity={layer.opacity}>
      {/* Drop shadow */}
      <Text x={layer.x + 1} y={layer.y + 1} text={layer.text} fontSize={layer.fontSize} fontFamily={layer.fontFamily}
        fontStyle={fontStyle} fill="rgba(0,0,0,0.2)" align={layer.align} width={layer.width} rotation={layer.rotation} listening={false} lineHeight={1.2} />
      {/* Main text */}
      <Text x={layer.x} y={layer.y} text={layer.text} fontSize={layer.fontSize} fontFamily={layer.fontFamily}
        fontStyle={fontStyle} fill={layer.fill} align={layer.align} width={layer.width} rotation={layer.rotation}
        draggable={!layer.locked} onClick={onSelect} onTap={onSelect} lineHeight={1.2}
        onDragEnd={(e) => { updateLayer(project.activeScreenshotId, layer.id, { x: e.target.x(), y: e.target.y() }); }}
      />
      {isSelected && <Rect x={layer.x - 4} y={layer.y - 4} width={layer.width + 8} height={layer.fontSize * 1.2 * (layer.text.split("\n").length) + 8} stroke="#4f8cff" strokeWidth={1} dash={[4, 2]} listening={false} />}
    </Group>
  );
};

const BackgroundRenderer = ({ layer }: { layer: BackgroundLayer }) => {
  const { project } = useMockupStore();
  const { canvasWidth, canvasHeight } = project;
  const bgType = layer.backgroundType || (layer.useGradient ? "linear" : "solid");

  // Mesh gradient: generate on offscreen canvas, load as image
  const meshDataUrl = useMemo(() => {
    if (bgType !== "mesh" || !layer.meshColors?.length) return undefined;
    return generateMeshGradient(
      canvasWidth,
      canvasHeight,
      layer.meshColors,
      layer.meshSeed || 0,
      layer.panoramicSlot,
      layer.panoramicTotal ?? 6,
    );
  }, [bgType, layer.meshColors, layer.meshSeed, layer.panoramicSlot, layer.panoramicTotal, canvasWidth, canvasHeight]);

  const meshImage = useLoadImage(meshDataUrl);
  const bgImage = useLoadImage(bgType === "image" ? layer.imageUrl : undefined);

  // Image background with dark overlay
  if (bgType === "image" && bgImage) {
    const overlayOpacity = layer.overlayOpacity ?? 0.4;
    return (
      <Group visible={layer.visible} opacity={layer.opacity} listening={false}>
        <KonvaImage image={bgImage} x={0} y={0} width={canvasWidth} height={canvasHeight} />
        {/* Dark gradient overlay for text readability */}
        <Rect x={0} y={0} width={canvasWidth} height={canvasHeight}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: canvasHeight }}
          fillLinearGradientColorStops={[0, `rgba(0,0,0,${overlayOpacity * 0.5})`, 0.4, `rgba(0,0,0,${overlayOpacity * 0.7})`, 1, `rgba(0,0,0,${overlayOpacity})`]}
        />
      </Group>
    );
  }

  if (bgType === "mesh" && meshImage) {
    return (
      <KonvaImage image={meshImage} x={0} y={0} width={canvasWidth} height={canvasHeight}
        visible={layer.visible} opacity={layer.opacity} listening={false} />
    );
  }

  if (bgType === "linear" && layer.gradientStart && layer.gradientEnd) {
    const angle = (layer.gradientAngle || 0) * (Math.PI / 180);
    const cx = canvasWidth / 2, cy = canvasHeight / 2, len = Math.max(canvasWidth, canvasHeight);
    return (
      <Rect x={0} y={0} width={canvasWidth} height={canvasHeight}
        fillLinearGradientStartPoint={{ x: cx - Math.cos(angle) * len, y: cy - Math.sin(angle) * len }}
        fillLinearGradientEndPoint={{ x: cx + Math.cos(angle) * len, y: cy + Math.sin(angle) * len }}
        fillLinearGradientColorStops={[0, layer.gradientStart, 1, layer.gradientEnd]}
        visible={layer.visible} opacity={layer.opacity} listening={false}
      />
    );
  }

  return <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill={layer.fill} visible={layer.visible} opacity={layer.opacity} listening={false} />;
};

const IconLayerRenderer = ({
  layer, isSelected, onSelect,
}: {
  layer: IconLayer; isSelected: boolean; onSelect: () => void;
}) => {
  const image = useLoadImage(layer.imageUrl);
  const { project, updateLayer } = useMockupStore();

  return (
    <Group visible={layer.visible} opacity={layer.opacity}>
      {image ? (
        <Group
          clipFunc={layer.cornerRadius > 0 ? (ctx: Konva.Context) => {
            const r = layer.cornerRadius;
            ctx.beginPath();
            ctx.moveTo(layer.x + r, layer.y);
            ctx.lineTo(layer.x + layer.width - r, layer.y);
            ctx.quadraticCurveTo(layer.x + layer.width, layer.y, layer.x + layer.width, layer.y + r);
            ctx.lineTo(layer.x + layer.width, layer.y + layer.height - r);
            ctx.quadraticCurveTo(layer.x + layer.width, layer.y + layer.height, layer.x + layer.width - r, layer.y + layer.height);
            ctx.lineTo(layer.x + r, layer.y + layer.height);
            ctx.quadraticCurveTo(layer.x, layer.y + layer.height, layer.x, layer.y + layer.height - r);
            ctx.lineTo(layer.x, layer.y + r);
            ctx.quadraticCurveTo(layer.x, layer.y, layer.x + r, layer.y);
            ctx.closePath();
          } : undefined}
        >
          <KonvaImage image={image} x={layer.x} y={layer.y} width={layer.width} height={layer.height}
            draggable={!layer.locked} onClick={onSelect} onTap={onSelect}
            onDragEnd={(e) => { updateLayer(project.activeScreenshotId, layer.id, { x: e.target.x(), y: e.target.y() }); }}
          />
        </Group>
      ) : (
        <Rect x={layer.x} y={layer.y} width={layer.width} height={layer.height}
          fill="#333" cornerRadius={layer.cornerRadius} stroke="#555" strokeWidth={1} dash={[4, 2]}
          draggable={!layer.locked} onClick={onSelect} onTap={onSelect}
          onDragEnd={(e) => { updateLayer(project.activeScreenshotId, layer.id, { x: e.target.x(), y: e.target.y() }); }}
        />
      )}
      {isSelected && <Rect x={layer.x - 3} y={layer.y - 3} width={layer.width + 6} height={layer.height + 6} stroke="#4f8cff" strokeWidth={1} dash={[4, 2]} listening={false} cornerRadius={layer.cornerRadius} />}
    </Group>
  );
};

const ShapeLayerRenderer = ({
  layer, isSelected, onSelect,
}: {
  layer: ShapeLayer; isSelected: boolean; onSelect: () => void;
}) => {
  const { project, updateLayer } = useMockupStore();
  const commonProps = {
    visible: layer.visible,
    opacity: layer.opacity,
    draggable: !layer.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      updateLayer(project.activeScreenshotId, layer.id, { x: e.target.x(), y: e.target.y() });
    },
  };

  if (layer.shapeType === "circle") {
    return (
      <Group>
        <Circle x={layer.x + layer.width / 2} y={layer.y + layer.height / 2} radius={layer.width / 2}
          fill={layer.fill} rotation={layer.rotation}
          shadowColor={layer.fill} shadowBlur={layer.cornerRadius || 0}
          {...commonProps}
        />
        {isSelected && <Circle x={layer.x + layer.width / 2} y={layer.y + layer.height / 2} radius={layer.width / 2 + 4} stroke="#4f8cff" strokeWidth={1} dash={[4, 2]} listening={false} />}
      </Group>
    );
  }

  return (
    <Group>
      <Rect x={layer.x} y={layer.y} width={layer.width} height={layer.height}
        fill={layer.fill} cornerRadius={layer.cornerRadius} rotation={layer.rotation}
        shadowColor={layer.fill} shadowBlur={layer.cornerRadius || 0}
        {...commonProps}
      />
      {isSelected && <Rect x={layer.x - 4} y={layer.y - 4} width={layer.width + 8} height={layer.height + 8} stroke="#4f8cff" strokeWidth={1} dash={[4, 2]} listening={false} />}
    </Group>
  );
};

// Gap between screenshots on the infinite canvas
const SCREENSHOT_GAP = 40;

// Renders all layers for a single screenshot, offset by its position on the canvas
const ScreenshotGroup = ({
  screenshot, offsetX, isActive, onActivate,
}: {
  screenshot: import("@/stores/mockupStore").Screenshot;
  offsetX: number;
  isActive: boolean;
  onActivate: () => void;
}) => {
  const { project, selectedLayerId, selectLayer } = useMockupStore();
  const { canvasWidth, canvasHeight } = project;

  const handleSelect = useCallback((layerId: string) => {
    onActivate();
    selectLayer(layerId);
  }, [onActivate, selectLayer]);

  return (
    <Group x={offsetX} y={0}>
      {/* Screenshot name label above (outside clip) */}
      <Text x={0} y={-22} width={canvasWidth} text={screenshot.name}
        fontSize={12} fill={isActive ? "#4f8cff" : "#888"} align="center" fontStyle={isActive ? "bold" : "normal"} listening={false} />
      {/* Active indicator border (outside clip) */}
      {isActive && (
        <Rect x={-2} y={-2} width={canvasWidth + 4} height={canvasHeight + 4}
          stroke="#4f8cff" strokeWidth={2} cornerRadius={4} listening={false} />
      )}
      {/* Clipped group — all layers are clipped to canvas bounds */}
      <Group
        clipFunc={(ctx: Konva.Context) => {
          ctx.rect(0, 0, canvasWidth, canvasHeight);
        }}
      >
        {/* Clickable background to select this screenshot */}
        <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="transparent"
          onClick={onActivate} onTap={onActivate} />
        {/* Render all layers */}
        {screenshot.layers.map((layer) => {
          switch (layer.type) {
            case "background": return <BackgroundRenderer key={layer.id} layer={layer as BackgroundLayer} />;
            case "device": return <DeviceFrameRenderer key={layer.id} layer={layer as DeviceLayer} isSelected={selectedLayerId === layer.id} onSelect={() => handleSelect(layer.id)} />;
            case "text": return <TextLayerRenderer key={layer.id} layer={layer as TextLayer} isSelected={selectedLayerId === layer.id} onSelect={() => handleSelect(layer.id)} />;
            case "icon": return <IconLayerRenderer key={layer.id} layer={layer as IconLayer} isSelected={selectedLayerId === layer.id} onSelect={() => handleSelect(layer.id)} />;
            case "shape": return <ShapeLayerRenderer key={layer.id} layer={layer as ShapeLayer} isSelected={selectedLayerId === layer.id} onSelect={() => handleSelect(layer.id)} />;
            default: return null;
          }
        })}
      </Group>
    </Group>
  );
};

const MockupCanvas = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { project, selectedLayerId, selectLayer, setActiveScreenshot, zoom, setZoom } = useMockupStore();
  const fontsReady = useFontsReady();
  const [stagePos, setStagePos] = useState({ x: 60, y: 60 });
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) selectLayer(null);
  }, [selectLayer]);

  // Use refs to avoid re-binding wheel handler on every zoom/pan change
  const zoomRef = useRef(zoom);
  const stagePosRef = useRef(stagePos);
  zoomRef.current = zoom;
  stagePosRef.current = stagePos;

  // Scroll to zoom (Ctrl/Cmd + scroll), plain scroll to pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const oldZoom = zoomRef.current;
        const pos = stagePosRef.current;
        const direction = e.deltaY < 0 ? 1 : -1;
        const factor = 1.08;
        const newZoom = Math.max(0.1, Math.min(3, direction > 0 ? oldZoom * factor : oldZoom / factor));
        const mousePointTo = {
          x: (pointer.x - pos.x) / oldZoom,
          y: (pointer.y - pos.y) / oldZoom,
        };
        setStagePos({
          x: pointer.x - mousePointTo.x * newZoom,
          y: pointer.y - mousePointTo.y * newZoom,
        });
        setZoom(newZoom);
      } else {
        setStagePos((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  // Re-bind when fonts load (containerRef changes from loading div to canvas div)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setZoom, fontsReady]);

  // Space + drag to pan, middle mouse to pan (bound once, no re-binds)
  useEffect(() => {
    let spaceDown = false;
    let dragging = false;
    let lastPos = { x: 0, y: 0 };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest?.("input, textarea")) {
        e.preventDefault();
        spaceDown = true;
        containerRef.current?.style.setProperty("cursor", "grab");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? useMockupStore.getState().redo() : useMockupStore.getState().undo();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !(e.target as HTMLElement)?.closest?.("input, textarea")) {
        const state = useMockupStore.getState();
        if (state.selectedLayerId) {
          const ss = state.project.screenshots.find(s => s.id === state.project.activeScreenshotId);
          const layer = ss?.layers.find(l => l.id === state.selectedLayerId);
          if (layer && layer.type !== "background") {
            state.pushHistory();
            state.removeLayer(state.project.activeScreenshotId, state.selectedLayerId);
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown = false;
        dragging = false;
        containerRef.current?.style.setProperty("cursor", "default");
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (spaceDown || e.button === 1) {
        dragging = true;
        lastPos = { x: e.clientX, y: e.clientY };
        containerRef.current?.style.setProperty("cursor", "grabbing");
        e.preventDefault();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging && !spaceDown) return;
      if (!(e.buttons & 1) && !(e.buttons & 4)) { dragging = false; return; }
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };
      setStagePos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    const onMouseUp = () => {
      if (dragging) {
        dragging = false;
        containerRef.current?.style.setProperty("cursor", spaceDown ? "grab" : "default");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const el = containerRef.current;
    el?.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      el?.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  // Re-bind when fonts load (containerRef changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsReady]);

  // Fit all screenshots in view on first load / when screenshots change
  useEffect(() => {
    const count = project.screenshots.length;
    if (count === 0 || containerSize.w < 100 || containerSize.h < 100) return;
    const totalW = count * project.canvasWidth + (count - 1) * SCREENSHOT_GAP;
    const totalH = project.canvasHeight + 30; // 30 for label above
    const padX = 60, padY = 60;
    const scaleX = (containerSize.w - padX) / totalW;
    const scaleY = (containerSize.h - padY) / totalH;
    const fitZoom = Math.max(0.1, Math.min(1, Math.min(scaleX, scaleY)));
    setZoom(fitZoom);
    // Center the content in the viewport
    const contentW = totalW * fitZoom;
    const contentH = totalH * fitZoom;
    setStagePos({
      x: (containerSize.w - contentW) / 2,
      y: (containerSize.h - contentH) / 2,
    });
  // Only run when screenshot count changes or container resizes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.screenshots.length, containerSize.w, containerSize.h]);

  if (!fontsReady) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading fonts...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-muted/30 relative"
      style={{
        backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
      }}
    >
      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 z-10 text-[10px] text-muted-foreground bg-card/80 backdrop-blur-sm px-2 py-1 rounded border border-border">
        {Math.round(zoom * 100)}% — Scroll to pan, Ctrl+Scroll to zoom, Space+drag to pan
      </div>

      <Stage ref={stageRef}
        width={containerSize.w} height={containerSize.h}
        x={stagePos.x} y={stagePos.y}
        scaleX={zoom} scaleY={zoom}
        onClick={handleStageClick} onTap={handleStageClick}
      >
        <Layer>
          {project.screenshots.map((ss, i) => {
            const offsetX = i * (project.canvasWidth + SCREENSHOT_GAP);
            return (
              <ScreenshotGroup
                key={ss.id}
                screenshot={ss}
                offsetX={offsetX}
                isActive={project.activeScreenshotId === ss.id}
                onActivate={() => setActiveScreenshot(ss.id)}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export { MockupCanvas };
export default MockupCanvas;
