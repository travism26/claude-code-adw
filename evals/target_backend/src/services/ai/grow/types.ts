/**
 * Types specific to grow analysis
 */

import { BaseAnalysisResponse, BaseServicePayload } from '../core/types';

/**
 * Analysis types for cannabis grow recommendations
 */
export type AnalysisType =
  | 'general'           // Overall health assessment (default)
  | 'nutrients'         // Feeding schedule recommendations
  | 'diagnosis'         // Problem identification from symptoms
  | 'optimization'      // Yield improvement tips
  | 'harvest_timing';   // Harvest readiness indicators

/**
 * Grow details for analysis context
 */
export interface GrowInfo {
  id: string;
  strainName: string;
  strainType: 'indica' | 'sativa' | 'hybrid' | 'ruderalis' | null;
  growMethod: 'soil' | 'coco' | 'hydro' | 'dwc' | 'aero' | 'other' | null;
  growMedium: string | null;
  lightType: 'led' | 'hps' | 'mh' | 'cfl' | 'sun' | 'other' | null;
  lightWattage: number | null;
  growSpaceSqft: number | null;
  potSizeGallons: number | null;
  plantCount: number;
  phase: 'germination' | 'vegetative' | 'flowering' | 'harvest' | 'archived';
  phaseStartedAt: Date | null;
  startedAt: Date;
  harvestedAt: Date | null;
  notes: string | null;
}

/**
 * Log entry with environment and photos
 */
export interface LogEntry {
  id: string;
  loggedAt: Date;
  dayNumber: number | null;
  phase: 'germination' | 'vegetative' | 'flowering' | 'harvest' | null;
  heightInches: number | null;
  notes: string | null;
  environment: EnvironmentData | null;
  photoCount: number;
}

/**
 * Environmental data from a log entry
 */
export interface EnvironmentData {
  temperatureF: number | null;
  humidityPercent: number | null;
  ph: number | null;
  ec: number | null;
  ppm: number | null;
  co2Ppm: number | null;
  lightHours: number | null;
  lightDistanceInches: number | null;
  vpd: number | null;
}

/**
 * Aggregated environmental trends
 */
export interface EnvironmentTrends {
  hasTrends: boolean;
  temperature: MetricTrend;
  humidity: MetricTrend;
  ph: MetricTrend;
  ec: MetricTrend;
  ppm: MetricTrend;
  co2: MetricTrend;
  lightHours: MetricTrend;
  lightDistance: MetricTrend;
  vpd: MetricTrend;
}

/**
 * Trend statistics for a single metric
 */
export interface MetricTrend {
  average: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

/**
 * Nutrient information
 */
export interface NutrientInfo {
  id: string;
  brand: string | null;
  productName: string;
  npkRatio: string | null;
  type: 'base' | 'supplement' | 'additive' | 'other' | null;
  dosageMl: number | null;
  frequency: string | null;
  phaseUsed: string | null;
}

/**
 * Harvest data
 */
export interface HarvestData {
  id: string;
  harvestedAt: Date;
  wetWeightGrams: number | null;
  dryWeightGrams: number | null;
  thcPercent: number | null;
  cbdPercent: number | null;
  terpeneProfile: string | null;
  qualityRating: number | null;
  notes: string | null;
}

/**
 * Calculated metrics
 */
export interface GrowMetrics {
  daysSinceStart: number;
  daysInPhase: number;
  growthRate: number | null;  // inches per day
  photoCount: number;
  logEntryCount: number;
  hasEnvironmentData: boolean;
  hasNutrientSchedule: boolean;
  hasHarvestData: boolean;
}

/**
 * Comprehensive grow context for AI analysis
 */
export interface GrowContext {
  grow: GrowInfo;
  logs: LogEntry[];
  environment: EnvironmentTrends;
  nutrients: NutrientInfo[];
  harvest: HarvestData | null;
  metrics: GrowMetrics;
  user: {
    timezone: string;
  };
}

/**
 * Grow analysis response
 */
export interface GrowAnalysisResponse extends BaseAnalysisResponse<GrowContext> {
  growId: string;
  userId: string;
  analysisType: AnalysisType;
}

/**
 * Grow analysis service payload
 */
export interface GrowAnalysisPayload extends BaseServicePayload {
  growId: string;
  type?: AnalysisType;
  triggeredBy?: string;
  timestamp?: string;
}
