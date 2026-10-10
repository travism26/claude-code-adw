import { useCallback } from "react";
import type { Plot } from "../types";
import { checkPlotBounds } from "../utils/gardenLayout";
import { toaster } from "../components/ChakraProvider";

interface DragState {
  isDragging: boolean;
  plotId?: string;
  currentX?: number;
  currentY?: number;
  isValidPosition?: boolean;
}

interface ResizeState {
  isResizing: boolean;
  plotId?: string;
  currentX?: number;
  currentY?: number;
  currentWidth?: number;
  currentHeight?: number;
  isValidResize?: boolean;
  originalPlot?: Plot;
}

interface PlotGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseCanvasInteractionParams {
  dragState: DragState;
  resizeState: ResizeState;
  garden: { width: number; height: number; plots?: Plot[] };
  onUpdatePlot: (plotId: string, data: PlotGeometry) => Promise<boolean>;
  onGeometryChange?: (plotId: string, before: PlotGeometry, after: PlotGeometry) => void;
}

export const useCanvasInteraction = ({
  dragState,
  resizeState,
  garden,
  onUpdatePlot,
  onGeometryChange,
}: UseCanvasInteractionParams) => {
  const handleDragComplete = useCallback(
    async (plot: Plot) => {
      const { currentX, currentY, isValidPosition } = dragState;

      if (currentX === undefined || currentY === undefined) return;

      if (Math.abs(plot.x - currentX) < 0.01 && Math.abs(plot.y - currentY) < 0.01) return;

      if (isValidPosition === false) {
        const updatedPlot = { ...plot, x: currentX, y: currentY };
        const isWithinBounds = checkPlotBounds(updatedPlot, garden);

        toaster.create({
          title: "Invalid placement",
          description: isWithinBounds ? "Plot overlaps with existing plot" : "Plot extends beyond garden boundaries",
          type: isWithinBounds ? "error" : "warning",
          duration: 3000,
        });
        return;
      }

      const before = { x: plot.x, y: plot.y, width: plot.width, height: plot.height };
      const after = { x: currentX, y: currentY, width: plot.width, height: plot.height };

      const success = await onUpdatePlot(plot.id, after);

      if (success) {
        onGeometryChange?.(plot.id, before, after);
        toaster.create({ title: "Plot moved", type: "success", duration: 2000 });
      }
    },
    [dragState, garden, onUpdatePlot, onGeometryChange]
  );

  const handleResizeComplete = useCallback(
    async () => {
      const { plotId, currentX, currentY, currentWidth, currentHeight, isValidResize, originalPlot } = resizeState;

      if (!plotId || !originalPlot) return;

      if (
        currentX === undefined ||
        currentY === undefined ||
        currentWidth === undefined ||
        currentHeight === undefined
      ) {
        return;
      }

      const hasChanged =
        Math.abs(originalPlot.x - currentX) > 0.01 ||
        Math.abs(originalPlot.y - currentY) > 0.01 ||
        Math.abs(originalPlot.width - currentWidth) > 0.01 ||
        Math.abs(originalPlot.height - currentHeight) > 0.01;

      if (!hasChanged) return;

      if (isValidResize === false) {
        const resizedPlot = { x: currentX, y: currentY, width: currentWidth, height: currentHeight };
        const isWithinBounds = checkPlotBounds(resizedPlot, garden);

        toaster.create({
          title: "Invalid resize",
          description: isWithinBounds ? "Plot overlaps with existing plot" : "Plot extends beyond garden boundaries",
          type: isWithinBounds ? "error" : "warning",
          duration: 3000,
        });
        return;
      }

      const before = {
        x: originalPlot.x,
        y: originalPlot.y,
        width: originalPlot.width,
        height: originalPlot.height,
      };
      const after = { x: currentX, y: currentY, width: currentWidth, height: currentHeight };

      const success = await onUpdatePlot(plotId, after);

      if (success) {
        onGeometryChange?.(plotId, before, after);
        toaster.create({ title: "Plot resized", type: "success", duration: 2000 });
      }
    },
    [resizeState, garden, onUpdatePlot, onGeometryChange]
  );

  return {
    handleDragComplete,
    handleResizeComplete,
  };
};
