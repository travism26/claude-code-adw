import { useState, useCallback } from "react";
import type { Plot, Garden } from "../types";
import {
  detectResizeHandle,
  calculateResizeBounds,
  applyResize,
  validateResize,
  type ResizeHandle,
} from "../utils/plotResize";

interface ResizeState {
  isResizing: boolean;
  plotId?: string;
  handle?: ResizeHandle;
  startX?: number;
  startY?: number;
  originalPlot?: Plot;
  currentWidth?: number;
  currentHeight?: number;
  currentX?: number;
  currentY?: number;
  isValidResize?: boolean;
}

interface UsePlotResizeParams {
  garden: Garden;
  snapEnabled: boolean;
  gridSize: number;
  convertPixelsToFeet: (pixels: number) => number;
  onPlotSelect?: (plot: Plot | null) => void;
}

export const usePlotResize = ({
  garden,
  snapEnabled,
  gridSize,
  convertPixelsToFeet,
  onPlotSelect,
}: UsePlotResizeParams) => {
  const [resizeState, setResizeState] = useState<ResizeState>({ isResizing: false });
  const [hoverHandle, setHoverHandle] = useState<ResizeHandle>("none");
  const [cursorStyle, setCursorStyle] = useState<string>("default");

  const handleResizeHandleMouseDown = useCallback(
    (plot: Plot, handle: ResizeHandle, e: React.PointerEvent) => {
      e.stopPropagation();
      onPlotSelect?.(plot);

      const svgElement = (e.currentTarget as SVGElement).ownerSVGElement;
      if (!svgElement) return;

      try {
        svgElement.setPointerCapture(e.pointerId);
      } catch {
        /* capture not supported / already released */
      }

      const rect = svgElement.getBoundingClientRect();
      const mouseXPixels = e.clientX - rect.left;
      const mouseYPixels = e.clientY - rect.top;
      const mouseXFeet = convertPixelsToFeet(mouseXPixels);
      const mouseYFeet = convertPixelsToFeet(mouseYPixels);

      setResizeState({
        isResizing: true,
        plotId: plot.id,
        handle,
        startX: mouseXFeet,
        startY: mouseYFeet,
        originalPlot: plot,
        currentWidth: plot.width,
        currentHeight: plot.height,
        currentX: plot.x,
        currentY: plot.y,
        isValidResize: true,
      });
    },
    [convertPixelsToFeet, onPlotSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseXPixels = e.clientX - rect.left;
      const mouseYPixels = e.clientY - rect.top;
      const mouseXFeet = convertPixelsToFeet(mouseXPixels);
      const mouseYFeet = convertPixelsToFeet(mouseYPixels);

      if (resizeState.isResizing && resizeState.plotId && resizeState.handle && resizeState.originalPlot) {
        const deltaX = mouseXFeet - (resizeState.startX || 0);
        const deltaY = mouseYFeet - (resizeState.startY || 0);

        const bounds = calculateResizeBounds(
          resizeState.originalPlot,
          { width: garden.width, height: garden.height },
          resizeState.handle
        );

        const resizeResult = applyResize(
          resizeState.originalPlot,
          resizeState.handle,
          deltaX,
          deltaY,
          bounds,
          snapEnabled,
          gridSize
        );

        const isValid = validateResize(
          resizeResult,
          resizeState.plotId,
          { width: garden.width, height: garden.height },
          garden.plots || []
        );

        setResizeState((prev) => ({
          ...prev,
          currentX: resizeResult.x,
          currentY: resizeResult.y,
          currentWidth: resizeResult.width,
          currentHeight: resizeResult.height,
          isValidResize: isValid,
        }));
      }
    },
    [resizeState, garden, snapEnabled, gridSize, convertPixelsToFeet]
  );

  const handleMouseUp = useCallback(() => {
    setResizeState({ isResizing: false });
  }, []);

  const updateHoverHandle = useCallback(
    (mouseXFeet: number, mouseYFeet: number, plot: Plot | undefined, selectedPlotId: string | null) => {
      if (!resizeState.isResizing && plot && selectedPlotId === plot.id) {
        const handleDetection = detectResizeHandle(mouseXFeet, mouseYFeet, plot, 0.3);
        setHoverHandle(handleDetection.handle);
        setCursorStyle(handleDetection.cursor);
      }
    },
    [resizeState.isResizing]
  );

  return {
    resizeState,
    hoverHandle,
    cursorStyle,
    handleResizeHandleMouseDown,
    handleMouseMove,
    handleMouseUp,
    updateHoverHandle,
  };
};
