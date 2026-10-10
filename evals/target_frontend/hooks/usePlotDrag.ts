import { useState, useCallback } from "react";
import type { Plot, Garden } from "../types";
import { checkPlotBounds, checkPlotOverlap, snapToGrid } from "../utils/gardenLayout";

interface DragState {
  isDragging: boolean;
  plotId?: string;
  startX?: number;
  startY?: number;
  offsetX?: number;
  offsetY?: number;
  currentX?: number;
  currentY?: number;
  isValidPosition?: boolean;
}

interface UsePlotDragParams {
  garden: Garden;
  snapEnabled: boolean;
  gridSize: number;
  convertPixelsToFeet: (pixels: number) => number;
  convertFeetToPixels: (feet: number) => number;
  onPlotSelect?: (plot: Plot | null) => void;
}

export const usePlotDrag = ({
  garden,
  snapEnabled,
  gridSize,
  convertPixelsToFeet,
  onPlotSelect,
}: UsePlotDragParams) => {
  const [dragState, setDragState] = useState<DragState>({ isDragging: false });

  // Pointer (mouse + touch + pen) handlers. Capturing the pointer on the SVG
  // keeps move/up events flowing to the canvas even if the finger drifts off
  // the plot, and lets us prevent the scroll container from panning mid-drag.
  const handlePlotMouseDown = useCallback(
    (plot: Plot, e: React.PointerEvent, selectedPlotId: string | null) => {
      e.stopPropagation();
      onPlotSelect?.(plot);

      const svg = (e.currentTarget as SVGElement).ownerSVGElement;
      try {
        svg?.setPointerCapture(e.pointerId);
      } catch {
        /* capture not supported / already released */
      }

      const plotRect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - plotRect.left;
      const offsetY = e.clientY - plotRect.top;

      setDragState({
        isDragging: true,
        plotId: plot.id,
        startX: e.clientX,
        startY: e.clientY,
        offsetX,
        offsetY,
      });
    },
    [onPlotSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragState.isDragging || !dragState.plotId) return;

      const plot = garden.plots?.find((p) => p.id === dragState.plotId);
      if (!plot) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const mouseXPixels = e.clientX - rect.left;
      const mouseYPixels = e.clientY - rect.top;
      const mouseXFeet = convertPixelsToFeet(mouseXPixels);
      const mouseYFeet = convertPixelsToFeet(mouseYPixels);

      const offsetXFeet = convertPixelsToFeet(dragState.offsetX || 0);
      const offsetYFeet = convertPixelsToFeet(dragState.offsetY || 0);

      let xFeet = mouseXFeet - offsetXFeet;
      let yFeet = mouseYFeet - offsetYFeet;

      if (snapEnabled) {
        xFeet = snapToGrid(xFeet, gridSize);
        yFeet = snapToGrid(yFeet, gridSize);
      }

      const clampedXFeet = Math.max(0, Math.min(xFeet, garden.width - plot.width));
      const clampedYFeet = Math.max(0, Math.min(yFeet, garden.height - plot.height));

      xFeet = clampedXFeet;
      yFeet = clampedYFeet;

      const updatedPlot = { ...plot, x: xFeet, y: yFeet };
      const isWithinBounds = checkPlotBounds(updatedPlot, { width: garden.width, height: garden.height });
      const hasOverlap = garden.plots?.some((existingPlot) => {
        if (existingPlot.id === dragState.plotId) return false;
        return checkPlotOverlap(updatedPlot, existingPlot);
      }) || false;

      const isValidPosition = isWithinBounds && !hasOverlap;

      setDragState((prev) => ({
        ...prev,
        currentX: xFeet,
        currentY: yFeet,
        isValidPosition,
      }));
    },
    [dragState, garden, snapEnabled, gridSize, convertPixelsToFeet]
  );

  const handleMouseUp = useCallback(() => {
    setDragState({ isDragging: false });
  }, []);

  return {
    dragState,
    handlePlotMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
};
