/**
 * Types specific to garden analysis
 */

import { BaseAnalysisResponse } from '../core/types';

export interface PlotContext {
  id: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  compassDirection: string | null;
  /**
   * Current lifecycle status of the plot:
   * - 'planned': Plot is defined but plants haven't been physically planted yet
   * - 'planted': Plants are in the ground and actively growing
   * - 'harvested': Plants have been harvested
   * - 'archived': Plot is no longer active
   */
  status: 'planned' | 'planted' | 'harvested' | 'archived';
  plant: PlantContext | null;
  notes: string | null;
}

export interface PlantContext {
  profileId: string;
  name: string;
  species: string | null;
  type: string;
  sunlightRequirements: string | null;
  spacingInches: number | null;
  plantFamily: string | null;
  zoneMin: number | null;
  zoneMax: number | null;
  difficulty: string;
}

export interface CompanionRule {
  plantAName: string;
  plantBName: string;
  relationship: 'beneficial' | 'harmful';
  notes: string | null;
}

export interface SeasonalTipInfo {
  plantName: string;
  season: string;
  tip: string;
  timing: number | null;
}

export interface GardenContext {
  garden: {
    id: string;
    name: string;
    dimensions: { width: number; height: number };
    zone: string | null;
  };
  user: {
    zone: string | null;
    timezone: string;
  };
  plots: PlotContext[];
  companionRules: CompanionRule[];
  seasonalTips: SeasonalTipInfo[];
  metrics: GardenMetrics;
}

export interface GardenMetrics {
  totalPlots: number;
  occupiedPlots: number;
  uniquePlants: number;
  averageSpacing: number | null;
  zoneCompatibilityIssues: number;
  companionConflicts: number;
  plannedPlots: number;
  plantedPlots: number;
  harvestedPlots: number;
}

export interface GardenAnalysisResponse extends BaseAnalysisResponse<GardenContext> {
  gardenId: string;
}
