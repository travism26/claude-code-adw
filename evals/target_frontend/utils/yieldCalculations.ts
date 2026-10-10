import type { Plot, YieldEstimate, YieldSummary, YieldByType, PlantProfileForPlot } from "../types";

// Default yield per plant by type (in lbs)
const DEFAULT_YIELDS: Record<string, { yield: number; unit: 'lbs' | 'count' | 'bunches' }> = {
  vegetable: { yield: 5, unit: 'lbs' },
  fruit: { yield: 10, unit: 'lbs' },
  herb: { yield: 0.5, unit: 'bunches' },
  flower: { yield: 1, unit: 'bunches' },
  houseplant: { yield: 0, unit: 'count' },
  tree: { yield: 50, unit: 'lbs' },
  succulent: { yield: 0, unit: 'count' },
  vine: { yield: 15, unit: 'lbs' },
};

// Default days to harvest by type
const DEFAULT_DAYS_TO_HARVEST: Record<string, number> = {
  vegetable: 60,
  fruit: 90,
  herb: 45,
  flower: 60,
  houseplant: 0,
  tree: 180,
  succulent: 0,
  vine: 75,
};

// Calculate number of plants that fit in a plot based on spacing
export const getPlantsPerPlot = (
  plotDimensions: { width: number; height: number },
  spacingInches: number
): number => {
  if (!spacingInches || spacingInches <= 0) {
    return 1;
  }

  const spacingFeet = spacingInches / 12;
  const plantsPerRow = Math.floor(plotDimensions.width / spacingFeet);
  const plantsPerColumn = Math.floor(plotDimensions.height / spacingFeet);

  return Math.max(1, plantsPerRow * plantsPerColumn);
};

// Get yield per plant based on plant profile or defaults
export const getYieldPerPlant = (
  plantType: string
): { yield: number; unit: 'lbs' | 'kg' | 'count' | 'bunches' } => {
  return DEFAULT_YIELDS[plantType] || { yield: 1, unit: 'count' };
};

// Get days to harvest based on plant type
export const getDaysToHarvest = (plantType: string): number => {
  return DEFAULT_DAYS_TO_HARVEST[plantType] || 60;
};

// Estimate harvest date
export const estimateHarvestDate = (
  daysToHarvest: number,
  plantingDate?: Date
): string | null => {
  if (!daysToHarvest || daysToHarvest === 0) {
    return null;
  }

  const startDate = plantingDate || new Date();
  const harvestDate = new Date(startDate);
  harvestDate.setDate(harvestDate.getDate() + daysToHarvest);

  return harvestDate.toISOString();
};

// Calculate yield estimate for a single plot
export const calculatePlotYield = (
  plot: Plot & { plantProfile?: PlantProfileForPlot | null },
  plantingDate?: Date
): YieldEstimate | null => {
  if (!plot.plantProfile) {
    return null;
  }

  const profile = plot.plantProfile;
  const spacingInches = profile.spacing_inches || 12;
  const plantsPerPlot = getPlantsPerPlot(
    { width: plot.width, height: plot.height },
    spacingInches
  );

  const yieldData = getYieldPerPlant(profile.type);
  const totalYield = yieldData.yield * plantsPerPlot;
  const daysToHarvest = getDaysToHarvest(profile.type);
  const harvestDate = estimateHarvestDate(daysToHarvest, plantingDate);

  // Determine confidence based on available data
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (profile.spacing_inches) {
    confidence = 'high';
  } else {
    confidence = 'low';
  }

  return {
    plotId: plot.id,
    plantName: profile.name,
    plantType: profile.type,
    estimatedYield: totalYield,
    unit: yieldData.unit,
    plantsPerPlot,
    yieldPerPlant: yieldData.yield,
    daysToHarvest: daysToHarvest > 0 ? daysToHarvest : null,
    harvestDate,
    confidence,
  };
};

// Calculate yield estimates for all plots
export const calculateAllPlotYields = (
  plots: (Plot & { plantProfile?: PlantProfileForPlot | null })[],
  plantingDate?: Date
): YieldEstimate[] => {
  return plots
    .map((plot) => calculatePlotYield(plot, plantingDate))
    .filter((estimate): estimate is YieldEstimate => estimate !== null);
};

// Aggregate yields by plant type
export const aggregateYieldsByType = (yieldEstimates: YieldEstimate[]): YieldByType[] => {
  const aggregated: Record<string, YieldByType> = {};

  for (const estimate of yieldEstimates) {
    if (!aggregated[estimate.plantType]) {
      aggregated[estimate.plantType] = {
        plantType: estimate.plantType,
        totalYield: 0,
        unit: estimate.unit,
        plotCount: 0,
      };
    }

    aggregated[estimate.plantType].totalYield += estimate.estimatedYield;
    aggregated[estimate.plantType].plotCount += 1;
  }

  return Object.values(aggregated);
};

// Create yield summary for a garden
export const createYieldSummary = (yieldEstimates: YieldEstimate[]): YieldSummary => {
  const totalYields = aggregateYieldsByType(yieldEstimates);

  // Find earliest and latest harvest dates
  const harvestDates = yieldEstimates
    .map((e) => e.harvestDate)
    .filter((date): date is string => date !== null)
    .sort();

  return {
    totalYields,
    totalPlots: yieldEstimates.length,
    earliestHarvest: harvestDates[0] || null,
    latestHarvest: harvestDates[harvestDates.length - 1] || null,
  };
};

// Format yield for display
export const formatYieldDisplay = (yield_: number, unit: string): string => {
  const formattedYield = yield_.toFixed(1);

  if (unit === 'lbs') {
    return `${formattedYield} lbs`;
  } else if (unit === 'kg') {
    return `${formattedYield} kg`;
  } else if (unit === 'count') {
    return `${Math.round(yield_)} plants`;
  } else if (unit === 'bunches') {
    return `${Math.round(yield_)} bunches`;
  }

  return `${formattedYield} ${unit}`;
};
