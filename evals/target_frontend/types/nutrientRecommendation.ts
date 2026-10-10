/**
 * Frontend types for Nutrient Recommendation feature
 * Mirrors backend types for type-safe API communication
 */

/**
 * Types of nutrient recommendations
 */
export type RecommendationType =
  | 'full_schedule'
  | 'phase_adjustment'
  | 'deficiency_fix'
  | 'optimization';

/**
 * Optimization goals for nutrient recommendations
 */
export type OptimizationGoal = 'yield' | 'quality' | 'balanced';

/**
 * Water parameters for nutrient application
 */
export interface WaterParameters {
  phMin: number;
  phMax: number;
  ecMin: number | null;
  ecMax: number | null;
  ppmMin: number | null;
  ppmMax: number | null;
}

/**
 * Individual nutrient product in schedule
 */
export interface NutrientScheduleNutrient {
  nutrientId?: string;
  productName: string;
  brand?: string;
  npkRatio?: string;
  type: 'base' | 'supplement' | 'additive' | 'other';
  dosageMlPerGallon: number;
  dosageMlPerLiter?: number;
  frequency: string;
  notes?: string;
}

/**
 * Single week in feeding schedule
 */
export interface NutrientScheduleItem {
  phase: 'germination' | 'vegetative' | 'flowering' | 'harvest';
  weekNumber: number;
  weekLabel: string;
  nutrients: NutrientScheduleNutrient[];
  waterParameters: WaterParameters;
  notes?: string;
}

/**
 * Main nutrient recommendation response
 */
export interface NutrientRecommendation {
  growId: string;
  userId: string;
  recommendationType: RecommendationType;
  optimizationGoal?: OptimizationGoal;
  deficiencyType?: string;
  summary: string;
  schedule: NutrientScheduleItem[];
  additionalTips: string[];
  warnings: string[];
  totalWeeks: number;
  estimatedCostPerWeek?: number;
  analyzedAt: string;
}

/**
 * Request payload for nutrient recommendation
 */
export interface NutrientRecommendationRequest {
  type?: RecommendationType;
  goal?: OptimizationGoal;
  deficiency?: string;
}

/**
 * API response when queueing nutrient recommendation
 */
export interface NutrientRecommendationQueueResponse {
  message: string;
  jobId: string;
  status: string;
  growId: string;
  analysisType: string;
  recommendationType?: RecommendationType;
  goal?: OptimizationGoal;
  remainingAnalyses: number;
}
