import type { Plot, PlotDimensions, GridPosition, SpacingWarning, PlantProfile } from "../types";

// Convert inches to feet
export const convertInchesToFeet = (inches: number): number => {
  return inches / 12;
};

// Convert feet to inches
export const convertFeetToInches = (feet: number): number => {
  return feet * 12;
};

// Snap a position to the nearest grid point
export const snapToGrid = (position: number, gridSize: number): number => {
  return Math.round(position / gridSize) * gridSize;
};

// Check if a plot is within garden bounds
export const checkPlotBounds = (
  plot: { x: number; y: number; width: number; height: number },
  gardenDimensions: PlotDimensions
): boolean => {
  return (
    plot.x >= 0 &&
    plot.y >= 0 &&
    plot.x + plot.width <= gardenDimensions.width &&
    plot.y + plot.height <= gardenDimensions.height
  );
};

// Check if two plots overlap
export const checkPlotOverlap = (
  plot1: { x: number; y: number; width: number; height: number },
  plot2: { x: number; y: number; width: number; height: number }
): boolean => {
  return !(
    plot1.x + plot1.width <= plot2.x ||
    plot2.x + plot2.width <= plot1.x ||
    plot1.y + plot1.height <= plot2.y ||
    plot2.y + plot2.height <= plot1.y
  );
};

// Calculate distance between two plot centers
export const calculatePlotDistance = (
  plot1: { x: number; y: number; width: number; height: number },
  plot2: { x: number; y: number; width: number; height: number }
): number => {
  const center1 = {
    x: plot1.x + plot1.width / 2,
    y: plot1.y + plot1.height / 2,
  };
  const center2 = {
    x: plot2.x + plot2.width / 2,
    y: plot2.y + plot2.height / 2,
  };

  const dx = center2.x - center1.x;
  const dy = center2.y - center1.y;

  return Math.sqrt(dx * dx + dy * dy);
};

// Calculate edge-to-edge distance between two plots
export const calculateEdgeDistance = (
  plot1: { x: number; y: number; width: number; height: number },
  plot2: { x: number; y: number; width: number; height: number }
): number => {
  // If plots overlap, distance is 0
  if (checkPlotOverlap(plot1, plot2)) {
    return 0;
  }

  const left1 = plot1.x;
  const right1 = plot1.x + plot1.width;
  const top1 = plot1.y;
  const bottom1 = plot1.y + plot1.height;

  const left2 = plot2.x;
  const right2 = plot2.x + plot2.width;
  const top2 = plot2.y;
  const bottom2 = plot2.y + plot2.height;

  // Horizontal distance
  let dx = 0;
  if (right1 <= left2) {
    dx = left2 - right1;
  } else if (right2 <= left1) {
    dx = left1 - right2;
  }

  // Vertical distance
  let dy = 0;
  if (bottom1 <= top2) {
    dy = top2 - bottom1;
  } else if (bottom2 <= top1) {
    dy = top1 - bottom2;
  }

  return Math.sqrt(dx * dx + dy * dy);
};

// Check spacing for a plot against all other plots
export const checkPlotSpacing = (
  plot: Plot & { plantProfile?: { spacing_inches?: number | null; name: string } },
  allPlots: (Plot & { plantProfile?: { spacing_inches?: number | null; name: string } })[],
  defaultSpacingInches: number = 12
): SpacingWarning[] => {
  const warnings: SpacingWarning[] = [];

  const plotSpacing = plot.plantProfile?.spacing_inches ?? defaultSpacingInches;
  const requiredDistanceFeet = convertInchesToFeet(plotSpacing);

  for (const otherPlot of allPlots) {
    // Skip comparing plot with itself
    if (otherPlot.id === plot.id) {
      continue;
    }

    const otherSpacing = otherPlot.plantProfile?.spacing_inches ?? defaultSpacingInches;
    const otherRequiredDistanceFeet = convertInchesToFeet(otherSpacing);

    // Use the maximum required spacing of the two plants
    const maxRequiredDistance = Math.max(requiredDistanceFeet, otherRequiredDistanceFeet);

    const edgeDistance = calculateEdgeDistance(plot, otherPlot);

    if (edgeDistance < maxRequiredDistance) {
      warnings.push({
        plotId: plot.id,
        nearbyPlotId: otherPlot.id,
        plantName: plot.plantProfile?.name ?? "Unknown",
        nearbyPlantName: otherPlot.plantProfile?.name ?? "Unknown",
        currentDistance: edgeDistance,
        requiredDistance: maxRequiredDistance,
        message: `${plot.plantProfile?.name ?? "Plant"} is too close to ${
          otherPlot.plantProfile?.name ?? "another plant"
        }. Distance: ${edgeDistance.toFixed(1)} ft, Required: ${maxRequiredDistance.toFixed(1)} ft`,
      });
    }
  }

  return warnings;
};

// Get all spacing warnings for all plots in a garden
export const getAllSpacingWarnings = (
  plots: (Plot & { plantProfile?: { spacing_inches?: number | null; name: string } })[]
): SpacingWarning[] => {
  const allWarnings: SpacingWarning[] = [];
  const seenPairs = new Set<string>();

  for (const plot of plots) {
    const plotWarnings = checkPlotSpacing(plot, plots);

    // Add warnings but avoid duplicates (A-B and B-A)
    for (const warning of plotWarnings) {
      const pairKey1 = `${warning.plotId}-${warning.nearbyPlotId}`;
      const pairKey2 = `${warning.nearbyPlotId}-${warning.plotId}`;

      if (!seenPairs.has(pairKey1) && !seenPairs.has(pairKey2)) {
        allWarnings.push(warning);
        seenPairs.add(pairKey1);
      }
    }
  }

  return allWarnings;
};
