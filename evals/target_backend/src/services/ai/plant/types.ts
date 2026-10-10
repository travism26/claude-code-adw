/**
 * Types specific to plant care analysis
 */

import { BaseAnalysisResponse } from '../core/types';

export interface PlantCareContext {
  plant: {
    id: string;
    name: string;
    species: string | null;
    type: string;
    plantFamily: string | null;
    difficulty: string;
    sunlightRequirements: string | null;
    spacingInches: number | null;
    zoneMin: number | null;
    zoneMax: number | null;
  };
  plot: {
    id: string;
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
    compassDirection: string | null;
    notes: string | null;
  } | null;
  garden: {
    id: string;
    name: string;
    zone: string | null;
  } | null;
  user: {
    zone: string | null;
    timezone: string;
  };
  careHistory: {
    lastWatered: Date | null;
    lastFertilized: Date | null;
    daysSinceWatered: number | null;
    daysSinceFertilized: number | null;
  };
  environmental: {
    currentSeason: string;
    zoneCompatible: boolean;
  };
}

export interface PlantCareResponse extends BaseAnalysisResponse<PlantCareContext> {
  plantId: string;
}
