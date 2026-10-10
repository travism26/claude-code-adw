/**
 * Types for AI Nutrient Recommendation Service
 *
 * This module defines the type system for cannabis nutrient recommendations.
 * Extends the base AI service types with nutrient-specific structures.
 */

import { BaseAnalysisResponse, BaseServicePayload } from '../../core/types';
import { GrowContext } from '../types';

/**
 * Types of nutrient recommendations the service can generate
 */
export type RecommendationType =
  | 'full_schedule'      // Complete feeding schedule from current phase to harvest
  | 'phase_adjustment'   // Adjust existing schedule for phase transition
  | 'deficiency_fix'     // Remediation schedule for nutrient deficiencies
  | 'optimization';      // Optimize existing schedule for yield/quality goals

/**
 * User goal for optimization recommendations
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
  nutrientId?: string;           // Optional reference to nutrient DB (if mapped)
  productName: string;            // Product name (e.g., "General Hydroponics FloraGro")
  brand?: string;                 // Brand name (e.g., "General Hydroponics")
  npkRatio?: string;              // NPK ratio (e.g., "3-1-2")
  type: 'base' | 'supplement' | 'additive' | 'other';
  dosageMlPerGallon: number;      // Dosage in ml per gallon
  dosageMlPerLiter?: number;      // Optional metric conversion
  frequency: string;              // Application frequency (e.g., "Every watering", "Weekly", "2x per week")
  notes?: string;                 // Product-specific notes (e.g., "Add first to reservoir")
}

/**
 * Single week in feeding schedule
 */
export interface NutrientScheduleItem {
  phase: 'germination' | 'vegetative' | 'flowering' | 'harvest';
  weekNumber: number;             // Week number in phase (1-indexed)
  weekLabel: string;              // Human-readable label (e.g., "Veg Week 3")
  nutrients: NutrientScheduleNutrient[];
  waterParameters: WaterParameters;
  notes?: string;                 // Week-specific guidance (e.g., "Begin transition to flower nutrients")
}

/**
 * Main nutrient recommendation response
 */
export interface NutrientRecommendation extends BaseAnalysisResponse<GrowContext> {
  growId: string;
  userId: string;
  recommendationType: RecommendationType;
  optimizationGoal?: OptimizationGoal;
  deficiencyType?: string;        // If deficiency_fix, what deficiency was addressed
  summary: string;                // Overall recommendation summary
  schedule: NutrientScheduleItem[]; // Week-by-week feeding schedule
  additionalTips: string[];       // Additional cultivation tips
  warnings: string[];             // Warnings about nutrient lockout, toxicity risks, etc.
  totalWeeks: number;             // Total weeks in schedule
  estimatedCostPerWeek?: number;  // Optional cost estimate (if we have pricing data)
}

/**
 * Payload for nutrient recommendation request
 */
export interface NutrientRecommendationPayload extends BaseServicePayload {
  growId: string;
  type?: RecommendationType;      // Default: 'full_schedule'
  goal?: OptimizationGoal;        // Default: 'balanced' (only used for optimization type)
  deficiency?: string;            // Required if type is 'deficiency_fix'
  aiTaskId?: string;              // Optional task ID for persistence (if needed in future)
}
