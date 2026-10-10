"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import type { Garden, Plot, PlantProfile } from "../../types";
import { PlotContextMenu } from "../PlotContextMenu";
import { toaster } from "../ChakraProvider";
import { CanvasControls } from "./CanvasControls";
import { CanvasGrid } from "./CanvasGrid";
import { PlotRenderer } from "./PlotRenderer";
import { usePlotDrag } from "../../hooks/usePlotDrag";
import { usePlotResize } from "../../hooks/usePlotResize";
import { usePlotContextMenu } from "../../hooks/usePlotContextMenu";
import { usePlotOperations } from "../../hooks/usePlotOperations";
import { useCanvasInteraction } from "../../hooks/useCanvasInteraction";
import { usePlotHistory } from "../../hooks/usePlotHistory";
import { usePlotSoftDelete } from "../../hooks/usePlotSoftDelete";

interface GardenCanvasProps {
  garden: Garden;
  selectedPlantProfile: PlantProfile | null;
  onPlotSelect?: (plot: Plot | null) => void;
  highlightedPlotIds?: string[];
}

const PIXELS_PER_FOOT = 50;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

interface CanvasSettings {
  zoom: number | null;
  showGrid: boolean;
  snapEnabled: boolean;
}

const loadCanvasSettings = (key: string): CanvasSettings => {
  const fallback: CanvasSettings = { zoom: null, showGrid: true, snapEnabled: true };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
};

const saveCanvasSettings = (key: string, settings: CanvasSettings) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    /* ignore quota / private-mode errors */
  }
};

export const GardenCanvas: React.FC<GardenCanvasProps> = ({
  garden,
  selectedPlantProfile,
  onPlotSelect,
  highlightedPlotIds = [],
}) => {
  const storageKey = `gb:garden-canvas:${garden.id}`;
  const persisted = useMemo(() => loadCanvasSettings(storageKey), [storageKey]);

  const [zoom, setZoom] = useState<number>(persisted.zoom ?? 1);
  const [gridSize] = useState(1);
  const [showGrid, setShowGrid] = useState<boolean>(persisted.showGrid);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(persisted.snapEnabled);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didFitRef = useRef(false);

  const canvasWidth = garden.width * PIXELS_PER_FOOT * zoom;
  const canvasHeight = garden.height * PIXELS_PER_FOOT * zoom;

  // Persist view preferences per-garden so zoom/grid/snap survive reloads.
  useEffect(() => {
    saveCanvasSettings(storageKey, { zoom, showGrid, snapEnabled });
  }, [storageKey, zoom, showGrid, snapEnabled]);

  const fitToView = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const availW = el.clientWidth - 32;
    const availH = el.clientHeight - 32;
    if (availW <= 0 || availH <= 0) return;
    const zw = availW / (garden.width * PIXELS_PER_FOOT);
    const zh = availH / (garden.height * PIXELS_PER_FOOT);
    const fit = Math.max(MIN_ZOOM, Math.min(zw, zh, MAX_ZOOM));
    setZoom(Number(fit.toFixed(2)));
  }, [garden.width, garden.height]);

  // On first load, fit the whole garden into view unless the user has a saved zoom.
  useLayoutEffect(() => {
    if (didFitRef.current) return;
    didFitRef.current = true;
    if (persisted.zoom == null) fitToView();
  }, [persisted.zoom, fitToView]);

  const convertPixelsToFeet = useCallback(
    (pixels: number) => pixels / (PIXELS_PER_FOOT * zoom),
    [zoom]
  );

  const convertFeetToPixels = useCallback(
    (feet: number) => feet * PIXELS_PER_FOOT * zoom,
    [zoom]
  );

  const getSafeIconUrl = useCallback((iconUrl: string | null | undefined): string => {
    const DEFAULT_ICON = "/plant-icons/default/generic-plant.svg";
    if (!iconUrl || typeof iconUrl !== "string") return DEFAULT_ICON;
    if (iconUrl.includes("..") || iconUrl.includes("\\") || iconUrl.includes("//")) return DEFAULT_ICON;
    const systemPaths = ["/etc/", "/var/", "/usr/", "/bin/", "/sbin/", "/root/", "/home/"];
    if (systemPaths.some((path) => iconUrl.toLowerCase().includes(path))) return DEFAULT_ICON;
    const iconPathRegex = /^\/plant-icons\/(vegetable|herb|flower|houseplant|fruit|tree|succulent|vine|default)\/[a-z0-9-]+\.(svg|png)$/;
    if (!iconPathRegex.test(iconUrl)) return DEFAULT_ICON;
    return iconUrl;
  }, []);

  const handlePlotSelectWrapper = useCallback(
    (plot: Plot | null) => {
      setSelectedPlotId(plot?.id || null);
      onPlotSelect?.(plot);
    },
    [onPlotSelect]
  );

  const history = usePlotHistory({ garden });
  const softDelete = usePlotSoftDelete({ garden, onPlotSelect: handlePlotSelectWrapper });

  const plotOps = usePlotOperations({
    garden,
    snapEnabled,
    gridSize,
    convertPixelsToFeet,
    onPlotSelect: handlePlotSelectWrapper,
    onPlotCreated: history.recordCreate,
  });

  const dragHook = usePlotDrag({
    garden,
    snapEnabled,
    gridSize,
    convertPixelsToFeet,
    convertFeetToPixels,
    onPlotSelect: handlePlotSelectWrapper,
  });

  const resizeHook = usePlotResize({
    garden,
    snapEnabled,
    gridSize,
    convertPixelsToFeet,
    onPlotSelect: handlePlotSelectWrapper,
  });

  const { contextMenu, handlePlotRightClick, openContextMenuAt, handleContextMenuClose } =
    usePlotContextMenu();

  // Long-press (touch) opens the context menu, since there is no right-click.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStart.current = null;
  }, []);

  // Pinch-to-zoom: track active pointers on the scroll container.
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);

  const pointerDistance = () => {
    const pts = [...activePointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2) {
      // Second finger down: start a pinch and abandon any drag/resize/long-press.
      pinchStartDist.current = pointerDistance();
      pinchStartZoom.current = zoom;
      dragHook.handleMouseUp();
      resizeHook.handleMouseUp();
      cancelLongPress();
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2 && pinchStartDist.current) {
      const factor = pointerDistance() / pinchStartDist.current;
      const next = Math.max(MIN_ZOOM, Math.min(pinchStartZoom.current * factor, MAX_ZOOM));
      setZoom(Number(next.toFixed(2)));
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchStartDist.current = null;
  };

  const interaction = useCanvasInteraction({
    dragState: dragHook.dragState,
    resizeState: resizeHook.resizeState,
    garden,
    onUpdatePlot: plotOps.handleUpdatePlot,
    onGeometryChange: history.recordGeometryChange,
  });

  const handlePlotMouseDown = (plot: Plot, e: React.PointerEvent) => {
    const svgElement = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const mouseXPixels = e.clientX - rect.left;
    const mouseYPixels = e.clientY - rect.top;
    const mouseXFeet = convertPixelsToFeet(mouseXPixels);
    const mouseYFeet = convertPixelsToFeet(mouseYPixels);

    resizeHook.updateHoverHandle(mouseXFeet, mouseYFeet, plot, selectedPlotId);

    if (resizeHook.hoverHandle !== "none" && selectedPlotId === plot.id) {
      resizeHook.handleResizeHandleMouseDown(plot, resizeHook.hoverHandle, e);
    } else {
      dragHook.handlePlotMouseDown(plot, e, selectedPlotId);
    }

    // Arm a long-press to open the context menu on touch devices.
    if (e.pointerType === "touch") {
      longPressFired.current = false;
      longPressStart.current = { x: e.clientX, y: e.clientY };
      const cx = e.clientX;
      const cy = e.clientY;
      cancelLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        dragHook.handleMouseUp();
        resizeHook.handleMouseUp();
        openContextMenuAt(plot, cx, cy);
      }, 500);
    }
  };

  const handleMouseMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseXPixels = e.clientX - rect.left;
    const mouseYPixels = e.clientY - rect.top;
    const mouseXFeet = convertPixelsToFeet(mouseXPixels);
    const mouseYFeet = convertPixelsToFeet(mouseYPixels);

    // A real drag cancels a pending long-press.
    if (longPressTimer.current && longPressStart.current) {
      const dx = e.clientX - longPressStart.current.x;
      const dy = e.clientY - longPressStart.current.y;
      if (Math.hypot(dx, dy) > 10) cancelLongPress();
    }

    if (resizeHook.resizeState.isResizing) {
      resizeHook.handleMouseMove(e);
      return;
    }

    if (dragHook.dragState.isDragging) {
      dragHook.handleMouseMove(e);
      return;
    }

    if (!dragHook.dragState.isDragging && !resizeHook.resizeState.isResizing && selectedPlotId) {
      const plot = garden.plots?.find((p) => p.id === selectedPlotId);
      if (plot) {
        resizeHook.updateHoverHandle(mouseXFeet, mouseYFeet, plot, selectedPlotId);
      }
    }
  };

  const handleMouseUp = async () => {
    cancelLongPress();

    // If a long-press just opened the context menu, don't also commit a move.
    if (longPressFired.current) {
      longPressFired.current = false;
      resizeHook.handleMouseUp();
      dragHook.handleMouseUp();
      return;
    }

    if (resizeHook.resizeState.isResizing) {
      await interaction.handleResizeComplete();
      resizeHook.handleMouseUp();
      return;
    }

    if (dragHook.dragState.isDragging && dragHook.dragState.plotId) {
      const plot = garden.plots?.find((p) => p.id === dragHook.dragState.plotId);
      if (plot) {
        await interaction.handleDragComplete(plot);
      }
      dragHook.handleMouseUp();
    }
  };

  const handleContextMenuViewDetails = (plot: Plot) => {
    onPlotSelect?.(plot);
    toaster.create({
      title: "Plot Details",
      description: `Position: (${plot.x.toFixed(1)}, ${plot.y.toFixed(1)}) ft, Size: ${plot.width.toFixed(1)} × ${plot.height.toFixed(1)} ft`,
      type: "info",
      duration: 4000,
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack keys while typing in a field.
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        history.redo();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedPlotId) {
        const plot = garden.plots?.find((p) => p.id === selectedPlotId);
        if (plot) softDelete.softDelete(plot);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlotId, garden.plots, softDelete, history]);

  return (
    <Box>
      <CanvasControls
        zoom={zoom}
        showGrid={showGrid}
        snapEnabled={snapEnabled}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onZoomIn={() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))}
        onZoomOut={() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))}
        onResetZoom={() => setZoom(1)}
        onFitToView={fitToView}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
        onUndo={history.undo}
        onRedo={history.redo}
      />

      <Box
        ref={scrollRef}
        overflow="auto"
        borderWidth="1px"
        borderColor="gray.300"
        rounded="md"
        bg="gray.50"
        p={4}
        maxH="70vh"
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerUp}
      >
        <svg
          width={canvasWidth}
          height={canvasHeight}
          onClick={(e) => plotOps.handleCreatePlot(e, selectedPlantProfile, dragHook.dragState.isDragging)}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          onPointerCancel={handleMouseUp}
          style={{ cursor: selectedPlantProfile ? "crosshair" : "default", touchAction: "manipulation" }}
        >
          <rect width={canvasWidth} height={canvasHeight} fill="#f0ede4" />

          <CanvasGrid
            width={garden.width}
            height={garden.height}
            gridSize={gridSize}
            pixelsPerFoot={PIXELS_PER_FOOT}
            zoom={zoom}
            showGrid={showGrid}
          />

          <rect
            width={canvasWidth}
            height={canvasHeight}
            fill="none"
            stroke="#4a5568"
            strokeWidth="2"
            pointerEvents="none"
          />

          {garden.plots
            ?.filter((plot) => !softDelete.isPendingDelete(plot.id))
            .sort((a, b) => a.x - b.x || a.y - b.y)
            .map((plot) => {
              const isDragging = dragHook.dragState.isDragging && dragHook.dragState.plotId === plot.id;
              const isResizing = resizeHook.resizeState.isResizing && resizeHook.resizeState.plotId === plot.id;

              let x = plot.x;
              let y = plot.y;
              let width = plot.width;
              let height = plot.height;

              if (isDragging && dragHook.dragState.currentX !== undefined && dragHook.dragState.currentY !== undefined) {
                x = dragHook.dragState.currentX;
                y = dragHook.dragState.currentY;
              }

              if (
                isResizing &&
                resizeHook.resizeState.currentX !== undefined &&
                resizeHook.resizeState.currentY !== undefined &&
                resizeHook.resizeState.currentWidth !== undefined &&
                resizeHook.resizeState.currentHeight !== undefined
              ) {
                x = resizeHook.resizeState.currentX;
                y = resizeHook.resizeState.currentY;
                width = resizeHook.resizeState.currentWidth;
                height = resizeHook.resizeState.currentHeight;
              }

              const isInvalidPosition = isDragging && dragHook.dragState.isValidPosition === false;
              const isInvalidResize = isResizing && resizeHook.resizeState.isValidResize === false;
              const isInvalid = isInvalidPosition || isInvalidResize;
              const isHighlighted = highlightedPlotIds.includes(plot.id);

              return (
                <PlotRenderer
                  key={plot.id}
                  plot={plot}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  isSelected={selectedPlotId === plot.id}
                  isHighlighted={isHighlighted}
                  isInvalid={isInvalid}
                  isDragging={isDragging}
                  isResizing={isResizing}
                  hoverHandle={resizeHook.hoverHandle}
                  cursorStyle={resizeHook.cursorStyle}
                  convertFeetToPixels={convertFeetToPixels}
                  zoom={zoom}
                  onMouseDown={handlePlotMouseDown}
                  onRightClick={handlePlotRightClick}
                  onResizeHandleMouseDown={resizeHook.handleResizeHandleMouseDown}
                  getSafeIconUrl={getSafeIconUrl}
                />
              );
            })}
        </svg>
      </Box>

      <Text fontSize="sm" color="gray.600" mt={2}>
        {plotOps.isCreating
          ? "Adding plot…"
          : selectedPlantProfile
          ? `Click on the canvas to place ${selectedPlantProfile.common_name || selectedPlantProfile.name}`
          : "Select a plant from the palette to add it to your garden"}
      </Text>

      {contextMenu.visible && contextMenu.plot && onPlotSelect && (
        <PlotContextMenu
          plot={contextMenu.plot}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleContextMenuClose}
          garden={garden}
          onEdit={(plot) => onPlotSelect(plot)}
          onDelete={softDelete.softDelete}
          onViewDetails={handleContextMenuViewDetails}
          onExpand={plotOps.handleExpandPlot}
        />
      )}
    </Box>
  );
};
