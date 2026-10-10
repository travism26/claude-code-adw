/**
 * Types specific to pest diagnosis analysis
 */

import { BaseAnalysisResponse } from '../core/types';

export interface PestDiagnosisContext {
  plant: {
    id: string;
    name: string;
    species: string | null;
    type: string;
    plantFamily: string | null;
    difficulty: string;
    sunlightRequirements: string | null;
    zoneMin: number | null;
    zoneMax: number | null;
  };
  user: {
    zone: string | null;
    timezone: string;
  };
  symptoms: {
    description: string;
    affectedParts: string[]; // e.g., ['leaves', 'stems', 'roots']
    severity: 'mild' | 'moderate' | 'severe';
    photoUrls?: string[];
  };
  environmental: {
    recentWeather?: string;
    currentSeason: string;
    indoorOrOutdoor: string;
  };
  recentChanges?: {
    newLocation?: boolean;
    wateringChange?: boolean;
    fertilizingChange?: boolean;
    otherChanges?: string;
  };
}

export interface PestDiagnosisResponse
  extends BaseAnalysisResponse<PestDiagnosisContext> {
  plantId: string;
}
