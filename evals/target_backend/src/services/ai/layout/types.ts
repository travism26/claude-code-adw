/**
 * Types specific to layout generation
 */

import { BaseAnalysisResponse, BaseServicePayload } from '../core/types';

export interface SunZone {
  zoneType: 'full_sun' | 'partial_shade' | 'shade';
  polygon: { x: number; y: number }[];
}

export interface LayoutPreferences {
  optimizationGoal: 'max_yield' | 'max_variety' | 'beginner_friendly';
  spacingMethod: 'intensive' | 'square_foot' | 'traditional';
  layoutStyle?: 'cottage' | 'formal' | 'four_square' | 'block' | 'scattered';
  yieldGoal?: 'fresh_eating' | 'light_preservation' | 'heavy_preservation';
  householdSize?: number;
}

export interface PlantMetadata {
  id: string;
  name: string;
  scientificName: string | null;
  type: string;
  spacingInches: number | null;
  sunRequirement: string | null;
  height: string | null;
  plantFamily: string | null;
  zonesMin: number | null;
  zonesMax: number | null;
  difficulty: string;
}

export interface CompanionRelationship {
  plantAId: string;
  plantAName: string;
  plantBId: string;
  plantBName: string;
  relationship: 'beneficial' | 'harmful';
  notes: string | null;
}

export interface PlantQuantity {
  plantProfileId: string;
  plantName: string;
  calculatedQuantity: number;
  reasoning: string;
}

export interface PlantPlacement {
  plantProfileId: string;
  plantName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  quantity: number;
  reasoning: string;
  plantCount?: number;
}

export interface LayoutOption {
  id: string;
  optimizationGoal: 'max_yield' | 'max_variety' | 'beginner_friendly';
  placements: PlantPlacement[];
  score: number;
  companionScore: number;
  spacingScore: number;
  accessibilityScore: number;
  warnings: string[];
}

export interface LayoutContext {
  garden: {
    id: string;
    name: string;
    dimensions: { width: number; height: number };
    zone: string | null;
  };
  user: {
    zone: string | null;
  };
  selectedPlants: PlantMetadata[];
  companionRules: CompanionRelationship[];
  sunZones: SunZone[];
  preferences: LayoutPreferences;
  availableSpace: number;
  plantQuantities?: PlantQuantity[];
  householdSize?: number;
}

export interface LayoutGenerationResponse extends BaseAnalysisResponse<LayoutContext> {
  gardenId: string;
  layouts: LayoutOption[];
}

export interface LayoutGenerationPayload extends BaseServicePayload {
  gardenId: string;
  plantProfileIds: string[];
  sunZones: SunZone[];
  preferences: LayoutPreferences;
}
