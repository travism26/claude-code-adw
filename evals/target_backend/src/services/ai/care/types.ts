/**
 * Types specific to care recommendation analysis
 */

import { BaseAnalysisResponse } from '../core/types';

export interface CareRecommendationContext {
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
    waterIntervalDays: number;
    fertIntervalDays: number | null;
  };
  user: {
    zone: string | null;
    timezone: string;
  };
  careHistory: {
    lastWatered: Date | null;
    lastFertilized: Date | null;
    daysSinceWatered: number | null;
    daysSinceFertilized: number | null;
    totalWaterings: number;
    totalFertilizations: number;
  };
  seasonalContext: {
    currentSeason: string;
    month: string;
    isGrowingSeason: boolean;
  };
  recommendations: {
    requestedType?: 'watering' | 'fertilizing' | 'pruning' | 'general';
    growthStage?: 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'dormant';
  };
}

export interface CareRecommendationResponse
  extends BaseAnalysisResponse<CareRecommendationContext> {
  plantId: string;
}
