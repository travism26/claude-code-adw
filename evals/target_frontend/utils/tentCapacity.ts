/**
 * Tent Capacity Calculator Utility
 *
 * Provides capacity calculations and preset tent sizes for cannabis cultivation.
 * Uses industry-standard formulas for plant density recommendations.
 */

/**
 * Preset tent sizes with dimensions and recommended plant counts
 * Dimensions are in inches, plant counts are based on industry standards
 */
export const TENT_PRESETS = [
  {
    label: "2x2",
    width: 24,
    depth: 24,
    height: 48,
    vegPlants: 4,
    flowerPlants: 1,
    recommendedWattage: 100,
  },
  {
    label: "2x4",
    width: 24,
    depth: 48,
    height: 60,
    vegPlants: 8,
    flowerPlants: 2,
    recommendedWattage: 200,
  },
  {
    label: "3x3",
    width: 36,
    depth: 36,
    height: 72,
    vegPlants: 9,
    flowerPlants: 4,
    recommendedWattage: 300,
  },
  {
    label: "4x4",
    width: 48,
    depth: 48,
    height: 80,
    vegPlants: 16,
    flowerPlants: 4,
    recommendedWattage: 400,
  },
  {
    label: "5x5",
    width: 60,
    depth: 60,
    height: 80,
    vegPlants: 25,
    flowerPlants: 6,
    recommendedWattage: 600,
  },
  {
    label: "4x8",
    width: 48,
    depth: 96,
    height: 80,
    vegPlants: 32,
    flowerPlants: 8,
    recommendedWattage: 800,
  },
] as const;

export type TentPreset = typeof TENT_PRESETS[number];

/**
 * Capacity calculation result
 */
export interface CapacityResult {
  squareFeet: number;
  vegPlants: number;
  flowerPlants: number;
  recommendedWattage: number;
}

/**
 * Type alias for CapacityResult (for backward compatibility)
 */
export type CapacityCalculation = CapacityResult;

/**
 * Calculate recommended plant capacity based on dimensions
 *
 * Formulas:
 * - Square Footage: (width_inches * depth_inches) / 144
 * - Vegetative Phase: 1 plant per 1-2 sq ft (using 1 sq ft for density)
 * - Flowering Phase: 1 plant per 2-4 sq ft (using 4 sq ft for canopy space)
 * - Recommended Wattage: 30-50W per sq ft for LED (using 40W)
 *
 * @param widthInches - Width of grow space in inches
 * @param depthInches - Depth of grow space in inches
 * @returns CapacityResult with calculated values
 */
export function calculateCapacity(widthInches: number, depthInches: number): CapacityResult {
  // Calculate square footage
  const squareFeet = (widthInches * depthInches) / 144;

  // Calculate plant counts
  // Veg: 1 plant per 1 sq ft (dense growth)
  const vegPlants = Math.floor(squareFeet);
  // Flower: 1 plant per 4 sq ft (canopy space needed)
  const flowerPlants = Math.max(1, Math.floor(squareFeet / 4));

  // Recommended LED wattage: 40W per sq ft
  const recommendedWattage = Math.round(squareFeet * 40);

  return {
    squareFeet: Math.round(squareFeet * 100) / 100,
    vegPlants,
    flowerPlants,
    recommendedWattage,
  };
}

/**
 * Suggest light wattage based on grow space square footage
 * Uses 30-50W per sq ft for LED lights
 *
 * @param squareFeet - Grow space in square feet
 * @returns Recommended wattage range
 */
export function suggestLightWattage(squareFeet: number): { min: number; max: number } {
  return {
    min: Math.round(squareFeet * 30),
    max: Math.round(squareFeet * 50),
  };
}

/**
 * Convert inches to feet string for display
 *
 * @param inches - Value in inches
 * @returns Formatted string with feet and optional inches
 */
export function inchesToFeetString(inches: number | null | undefined): string {
  if (inches === null || inches === undefined) return "";
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  if (remainingInches === 0) {
    return `${feet}'`;
  }
  return `${feet}'${remainingInches}"`;
}

/**
 * Format dimensions for display
 *
 * @param width - Width in inches
 * @param depth - Depth in inches
 * @param height - Height in inches (optional)
 * @returns Formatted dimension string (e.g., "4' x 4' x 6.5'")
 */
export function formatDimensions(
  width: number | null | undefined,
  depth: number | null | undefined,
  height?: number | null
): string {
  if (width === null || width === undefined || depth === null || depth === undefined) {
    return "";
  }

  const widthFeet = (width / 12).toFixed(1).replace(/\.0$/, "");
  const depthFeet = (depth / 12).toFixed(1).replace(/\.0$/, "");

  if (height !== null && height !== undefined) {
    const heightFeet = (height / 12).toFixed(1).replace(/\.0$/, "");
    return `${widthFeet}' x ${depthFeet}' x ${heightFeet}'`;
  }

  return `${widthFeet}' x ${depthFeet}'`;
}

/**
 * Find a matching preset based on dimensions
 *
 * @param width - Width in inches
 * @param depth - Depth in inches
 * @returns Matching preset or undefined
 */
export function findMatchingPreset(width: number, depth: number): TentPreset | undefined {
  return TENT_PRESETS.find(
    (preset) =>
      (preset.width === width && preset.depth === depth) ||
      (preset.width === depth && preset.depth === width)
  );
}
