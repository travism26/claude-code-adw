/**
 * Grow Analysis Types
 *
 * Type definitions for AI-powered grow analysis features including:
 * - Grow analysis (5 types: general, nutrients, diagnosis, optimization, harvest_timing)
 * - Photo deficiency detection
 * - Nutrient recommendations
 */

import type { SuggestionPriority } from './suggestion';

/**
 * Analysis type for grow analysis requests
 */
export type AnalysisType =
  | 'general'
  | 'nutrients'
  | 'diagnosis'
  | 'optimization'
  | 'harvest_timing';

/**
 * Recommendation type for nutrient recommendations
 */
export type NutrientRecommendationType =
  | 'full_schedule'
  | 'phase_adjustment'
  | 'deficiency_fix'
  | 'optimization';

/**
 * Goal for nutrient recommendations
 */
export type RecommendationGoal = 'yield' | 'quality' | 'balanced';

/**
 * Individual suggestion from AI analysis
 * Matches backend GrowAnalysis model structure
 */
export interface AnalysisSuggestion {
  type: string;
  category: string;
  title: string;
  description: string;
  affectedIds: string[];
  priority: SuggestionPriority;
  actionable: boolean;
}

/**
 * Grow Analysis result
 * Matches backend GrowAnalysis model
 */
export interface GrowAnalysis {
  id: string;
  grow_id: string;
  user_id: string;
  ai_task_id: string | null;
  suggestions: AnalysisSuggestion[];
  overall_score: number;
  summary: string;
  is_current: boolean;
  analyzed_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request body for requesting a grow analysis
 */
export interface RequestAnalysisRequest {
  type?: AnalysisType;
  context?: string;
  recommendationType?: NutrientRecommendationType;
  goal?: RecommendationGoal;
  deficiency?: string;
}

/**
 * Response from grow analysis endpoint
 */
export interface RequestAnalysisResponse {
  jobId: string;
  status: string;
  remainingAnalyses: number;
}

/**
 * Request body for photo analysis
 */
export interface RequestPhotoAnalysisRequest {
  photoId: string;
  context?: string;
}

/**
 * Photo analysis result
 */
export interface PhotoAnalysisResult {
  photoId: string;
  logId: string;
  deficiencies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    confidence: number;
    description: string;
    affectedAreas?: string[];
  }>;
  overallHealth: number;
  summary: string;
  suggestions: AnalysisSuggestion[];
  analyzedAt: string;
}

/**
 * Response from photo analysis endpoint
 */
export interface RequestPhotoAnalysisResponse {
  jobId: string;
  status: string;
  remainingAnalyses: number;
}

/**
 * Analysis usage statistics (renamed to avoid conflict with analysisUsage types)
 */
export interface GrowAnalysisUsageResponse {
  userId: string;
  date: string;
  growAnalysisCount: number;
  photoAnalysisCount: number;
  growAnalysisLimit: number;
  photoAnalysisLimit: number;
  growAnalysisRemaining: number;
  photoAnalysisRemaining: number;
  bonusAnalyses: number;
}

/**
 * Can analyze check result (renamed to avoid conflict with analysisUsage types)
 */
export interface GrowCanAnalyzeResponse {
  canAnalyze: boolean;
  reason?: 'limit_reached' | 'analysis_pending' | 'feature_disabled';
  remainingAnalyses?: number;
}

/**
 * Filters for fetching analysis history
 */
export interface AnalysisHistoryFilters {
  analysisType?: AnalysisType;
  limit?: number;
  offset?: number;
}

/**
 * Response for analysis history endpoint
 */
export interface AnalysisHistoryResponse {
  analyses: GrowAnalysis[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * WebSocket event for grow analysis completion
 */
export interface GrowAnalysisCompletedEvent {
  growId: string;
  analysisId: string;
  overallScore: number;
  summary: string;
  suggestions: AnalysisSuggestion[];
}

/**
 * WebSocket event for photo analysis completion
 */
export interface GrowPhotoAnalysisCompletedEvent {
  logId: string;
  photoId: string;
  result: PhotoAnalysisResult;
}

/**
 * WebSocket event for nutrient recommendation completion
 */
export interface GrowNutrientRecommendationCompletedEvent {
  growId: string;
  analysisId: string;
  recommendations: AnalysisSuggestion[];
}
