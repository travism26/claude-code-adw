// Shared dose-formatting + display-unit conversion for the feeding schedule UI.

export const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

// Display-unit conversion factors from canonical ml/gal (volumetric units only).
export const UNIT_FACTORS: Record<string, number> = {
  "ml/gal": 1,
  "ml/L": 1 / 3.785411784,
  "tsp/gal": 1 / 4.92892,
  "tbsp/gal": 1 / 14.7868,
};

export const UNIT_OPTIONS = Object.keys(UNIT_FACTORS);

export const convertDose = (mlPerGal: number, unit: string) =>
  mlPerGal * (UNIT_FACTORS[unit] ?? 1);
