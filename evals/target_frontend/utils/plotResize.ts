import type { Plot } from "../types";
import { snapToGrid, checkPlotBounds, checkPlotOverlap } from "./gardenLayout";

/**
 * Resize handle types for plot edges and corners
 */
export type ResizeHandle =
  | "none"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * Result of resize handle detection
 */
export interface ResizeHandleDetection {
  handle: ResizeHandle;
  cursor: string;
}

/**
 * Resize bounds with min/max constraints
 */
export interface ResizeBounds {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Result of resize operation
 */
export interface ResizeResult {
  x: number;
  y: number;
  width: number;
  height: number;
  isValid: boolean;
}

/**
 * Detects which resize handle (if any) the mouse is near
 * @param mouseX - Mouse X position in feet
 * @param mouseY - Mouse Y position in feet
 * @param plot - The plot to check
 * @param threshold - Distance threshold in feet for handle detection (default 0.3)
 * @returns ResizeHandleDetection object with handle type and cursor style
 */
export function detectResizeHandle(
  mouseX: number,
  mouseY: number,
  plot: Plot,
  threshold: number = 0.3
): ResizeHandleDetection {
  const plotLeft = plot.x;
  const plotRight = plot.x + plot.width;
  const plotTop = plot.y;
  const plotBottom = plot.y + plot.height;

  // Check distances to edges
  const distToLeft = Math.abs(mouseX - plotLeft);
  const distToRight = Math.abs(mouseX - plotRight);
  const distToTop = Math.abs(mouseY - plotTop);
  const distToBottom = Math.abs(mouseY - plotBottom);

  const nearLeft = distToLeft < threshold && mouseY >= plotTop && mouseY <= plotBottom;
  const nearRight = distToRight < threshold && mouseY >= plotTop && mouseY <= plotBottom;
  const nearTop = distToTop < threshold && mouseX >= plotLeft && mouseX <= plotRight;
  const nearBottom = distToBottom < threshold && mouseX >= plotLeft && mouseX <= plotRight;

  // Check corners first (higher priority)
  if (distToLeft < threshold && distToTop < threshold) {
    return { handle: "top-left", cursor: "nw-resize" };
  }
  if (distToRight < threshold && distToTop < threshold) {
    return { handle: "top-right", cursor: "ne-resize" };
  }
  if (distToLeft < threshold && distToBottom < threshold) {
    return { handle: "bottom-left", cursor: "sw-resize" };
  }
  if (distToRight < threshold && distToBottom < threshold) {
    return { handle: "bottom-right", cursor: "se-resize" };
  }

  // Check edges
  if (nearTop) return { handle: "top", cursor: "n-resize" };
  if (nearRight) return { handle: "right", cursor: "e-resize" };
  if (nearBottom) return { handle: "bottom", cursor: "s-resize" };
  if (nearLeft) return { handle: "left", cursor: "w-resize" };

  return { handle: "none", cursor: "grab" };
}

/**
 * Calculates valid resize bounds for a plot
 * @param plot - The plot being resized
 * @param gardenDimensions - Garden width and height
 * @param handle - The resize handle being used
 * @returns ResizeBounds object with constraints
 */
export function calculateResizeBounds(
  plot: Plot,
  gardenDimensions: { width: number; height: number },
  handle: ResizeHandle
): ResizeBounds {
  const MIN_PLOT_SIZE = 0.1; // Minimum 0.1 ft in each dimension

  // Default bounds (will be adjusted based on handle)
  let minWidth = MIN_PLOT_SIZE;
  let minHeight = MIN_PLOT_SIZE;
  let maxWidth = gardenDimensions.width;
  let maxHeight = gardenDimensions.height;
  let minX = 0;
  let minY = 0;
  let maxX = gardenDimensions.width;
  let maxY = gardenDimensions.height;

  // Adjust based on handle type
  switch (handle) {
    case "top":
    case "top-left":
    case "top-right":
      // Can't move top edge below bottom edge
      maxY = plot.y + plot.height - MIN_PLOT_SIZE;
      break;
    case "bottom":
    case "bottom-left":
    case "bottom-right":
      // Bottom edge limited by garden height
      maxY = gardenDimensions.height;
      break;
  }

  switch (handle) {
    case "left":
    case "top-left":
    case "bottom-left":
      // Can't move left edge beyond right edge
      maxX = plot.x + plot.width - MIN_PLOT_SIZE;
      break;
    case "right":
    case "top-right":
    case "bottom-right":
      // Right edge limited by garden width
      maxX = gardenDimensions.width;
      break;
  }

  return {
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    minX,
    minY,
    maxX,
    maxY,
  };
}

/**
 * Applies resize operation to a plot based on handle and mouse delta
 * @param plot - Original plot
 * @param handle - Resize handle being dragged
 * @param deltaX - Mouse movement in X (feet)
 * @param deltaY - Mouse movement in Y (feet)
 * @param bounds - Resize bounds constraints
 * @param snapEnabled - Whether to snap to grid
 * @param gridSize - Grid size in feet
 * @returns ResizeResult with new dimensions and validity status
 */
export function applyResize(
  plot: Plot,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  bounds: ResizeBounds,
  snapEnabled: boolean = false,
  gridSize: number = 1
): ResizeResult {
  let newX = plot.x;
  let newY = plot.y;
  let newWidth = plot.width;
  let newHeight = plot.height;

  // Apply resize based on handle
  switch (handle) {
    case "top":
      newY = plot.y + deltaY;
      newHeight = plot.height - deltaY;
      break;

    case "bottom":
      newHeight = plot.height + deltaY;
      break;

    case "left":
      newX = plot.x + deltaX;
      newWidth = plot.width - deltaX;
      break;

    case "right":
      newWidth = plot.width + deltaX;
      break;

    case "top-left":
      newX = plot.x + deltaX;
      newY = plot.y + deltaY;
      newWidth = plot.width - deltaX;
      newHeight = plot.height - deltaY;
      break;

    case "top-right":
      newY = plot.y + deltaY;
      newWidth = plot.width + deltaX;
      newHeight = plot.height - deltaY;
      break;

    case "bottom-left":
      newX = plot.x + deltaX;
      newWidth = plot.width - deltaX;
      newHeight = plot.height + deltaY;
      break;

    case "bottom-right":
      newWidth = plot.width + deltaX;
      newHeight = plot.height + deltaY;
      break;

    default:
      return {
        x: plot.x,
        y: plot.y,
        width: plot.width,
        height: plot.height,
        isValid: true,
      };
  }

  // Apply snap to grid if enabled
  if (snapEnabled) {
    newX = snapToGrid(newX, gridSize);
    newY = snapToGrid(newY, gridSize);
    newWidth = snapToGrid(newWidth, gridSize);
    newHeight = snapToGrid(newHeight, gridSize);
  }

  // Enforce minimum dimensions
  newWidth = Math.max(newWidth, bounds.minWidth);
  newHeight = Math.max(newHeight, bounds.minHeight);

  // Enforce bounds constraints
  newX = Math.max(bounds.minX, Math.min(newX, bounds.maxX));
  newY = Math.max(bounds.minY, Math.min(newY, bounds.maxY));

  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
    isValid: true, // Will be validated separately
  };
}

/**
 * Validates a resized plot position
 * @param resizedPlot - The resized plot dimensions
 * @param originalPlotId - ID of the plot being resized
 * @param gardenDimensions - Garden dimensions
 * @param allPlots - All plots in the garden
 * @returns true if resize is valid, false otherwise
 */
export function validateResize(
  resizedPlot: { x: number; y: number; width: number; height: number },
  originalPlotId: string,
  gardenDimensions: { width: number; height: number },
  allPlots: Plot[]
): boolean {
  // Check if within bounds
  if (!checkPlotBounds(resizedPlot, gardenDimensions)) {
    return false;
  }

  // Check for overlaps with other plots
  const hasOverlap = allPlots.some((existingPlot) => {
    if (existingPlot.id === originalPlotId) return false;
    return checkPlotOverlap(resizedPlot, existingPlot);
  });

  return !hasOverlap;
}

/**
 * Calculates maximum expansion amount in a specific direction
 * @param plot - The plot to expand
 * @param direction - Direction to expand ('up', 'down', 'left', 'right')
 * @param gardenDimensions - Garden dimensions
 * @param allPlots - All plots in the garden
 * @returns Maximum safe expansion in feet, or 0 if cannot expand
 */
export function calculateMaxExpansion(
  plot: Plot,
  direction: "up" | "down" | "left" | "right",
  gardenDimensions: { width: number; height: number },
  allPlots: Plot[]
): number {
  let maxExpansion = 0;

  switch (direction) {
    case "up":
      // Can expand up to y=0
      maxExpansion = plot.y;
      // Check for plots above
      for (const otherPlot of allPlots) {
        if (otherPlot.id === plot.id) continue;
        // Check if plot is above and would block expansion
        if (
          otherPlot.x < plot.x + plot.width &&
          otherPlot.x + otherPlot.width > plot.x &&
          otherPlot.y + otherPlot.height <= plot.y
        ) {
          const gap = plot.y - (otherPlot.y + otherPlot.height);
          maxExpansion = Math.min(maxExpansion, gap);
        }
      }
      break;

    case "down":
      // Can expand down to garden height
      maxExpansion = gardenDimensions.height - (plot.y + plot.height);
      // Check for plots below
      for (const otherPlot of allPlots) {
        if (otherPlot.id === plot.id) continue;
        if (
          otherPlot.x < plot.x + plot.width &&
          otherPlot.x + otherPlot.width > plot.x &&
          otherPlot.y >= plot.y + plot.height
        ) {
          const gap = otherPlot.y - (plot.y + plot.height);
          maxExpansion = Math.min(maxExpansion, gap);
        }
      }
      break;

    case "left":
      // Can expand left to x=0
      maxExpansion = plot.x;
      // Check for plots to the left
      for (const otherPlot of allPlots) {
        if (otherPlot.id === plot.id) continue;
        if (
          otherPlot.y < plot.y + plot.height &&
          otherPlot.y + otherPlot.height > plot.y &&
          otherPlot.x + otherPlot.width <= plot.x
        ) {
          const gap = plot.x - (otherPlot.x + otherPlot.width);
          maxExpansion = Math.min(maxExpansion, gap);
        }
      }
      break;

    case "right":
      // Can expand right to garden width
      maxExpansion = gardenDimensions.width - (plot.x + plot.width);
      // Check for plots to the right
      for (const otherPlot of allPlots) {
        if (otherPlot.id === plot.id) continue;
        if (
          otherPlot.y < plot.y + plot.height &&
          otherPlot.y + otherPlot.height > plot.y &&
          otherPlot.x >= plot.x + plot.width
        ) {
          const gap = otherPlot.x - (plot.x + plot.width);
          maxExpansion = Math.min(maxExpansion, gap);
        }
      }
      break;
  }

  return Math.max(0, maxExpansion);
}

/**
 * Applies directional expansion to a plot
 * @param plot - The plot to expand
 * @param direction - Direction to expand
 * @param amount - Amount to expand in feet (if not provided, uses max expansion)
 * @returns New plot dimensions after expansion
 */
export function applyExpansion(
  plot: Plot,
  direction: "up" | "down" | "left" | "right",
  amount?: number
): { x: number; y: number; width: number; height: number } {
  const result = { x: plot.x, y: plot.y, width: plot.width, height: plot.height };

  const expansionAmount = amount || 1; // Default 1 ft expansion

  switch (direction) {
    case "up":
      result.y -= expansionAmount;
      result.height += expansionAmount;
      break;
    case "down":
      result.height += expansionAmount;
      break;
    case "left":
      result.x -= expansionAmount;
      result.width += expansionAmount;
      break;
    case "right":
      result.width += expansionAmount;
      break;
  }

  return result;
}
