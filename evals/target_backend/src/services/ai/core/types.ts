/**
 * Core types shared across all AI services
 */

export interface AIPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export interface BaseAnalysisResponse<T = any> {
  analyzedAt: Date;
  context: T;
  suggestions: Suggestion[];
  overallScore: number;
  summary: string;
}

export interface Suggestion {
  type: 'improvement' | 'warning' | 'optimization';
  category: string;
  title: string;
  description: string;
  affectedIds: string[];
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface AIServiceConfig {
  enableAICalls: boolean;
  logPrompts: boolean;
  maxRetries?: number;
}

/**
 * Base payload for all AI service execute() methods
 */
export interface BaseServicePayload {
  userId: string;
  aiTaskId?: string;
}

/**
 * Garden analysis service payload
 */
export interface GardenAnalysisPayload extends BaseServicePayload {
  gardenId: string;
  triggeredBy?: string;
  timestamp?: string;
}

/**
 * Plant care service payload
 */
export interface PlantCarePayload extends BaseServicePayload {
  plantId: string;
}

/**
 * Pest diagnosis service payload
 */
export interface PestDiagnosisPayload extends BaseServicePayload {
  plantId: string;
  symptoms?: string;
}

/**
 * Care recommendation service payload
 */
export interface CareRecommendationPayload extends BaseServicePayload {
  plantId: string;
}

/**
 * Weather action service payload
 */
export interface WeatherActionPayload extends BaseServicePayload {
  gardenId: string;
  weatherData?: any;
}
