/**
 * Suggestion Type Definitions
 *
 * Types for AI-generated garden suggestions and analysis results.
 */

/**
 * Type of suggestion indicating its purpose
 */
export type SuggestionType = 'optimization' | 'improvement' | 'warning';

/**
 * Category of suggestion indicating what aspect of the garden it addresses
 */
export type SuggestionCategory =
  | 'layout'
  | 'sunlight'
  | 'companion_planting'
  | 'spacing'
  | 'seasonal_timing'
  | 'zone_compatibility';

/**
 * Priority level for the suggestion
 */
export type SuggestionPriority = 'high' | 'medium' | 'low';

/**
 * Individual AI-generated suggestion for a garden
 */
export interface Suggestion {
  /** Type of suggestion (optimization, improvement, or warning) */
  type: SuggestionType;

  /** Category that the suggestion addresses */
  category: SuggestionCategory;

  /** Brief title summarizing the suggestion */
  title: string;

  /** Detailed description of the suggestion and recommended actions */
  description: string;

  /** Array of plot IDs affected by this suggestion */
  affectedIds: string[];

  /** Priority level indicating importance */
  priority: SuggestionPriority;

  /** Whether this suggestion can be acted upon by the user */
  actionable: boolean;
}

/**
 * Complete garden analysis response from the AI service
 */
export interface GardenAnalysis {
  /** Array of suggestions for the garden */
  suggestions: Suggestion[];

  /** Overall health/quality score from 0-100 */
  overallScore: number;

  /** Brief summary of the garden's overall state */
  summary: string;
}

/**
 * Analysis job status from the queue system
 */
export type AnalysisJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Response from the analyze endpoint when enqueueing an analysis job
 */
export interface AnalysisJobResponse {
  /** Message describing the job status */
  message: string;

  /** Unique identifier for the queued job */
  jobId: string;

  /** Current status of the analysis job */
  status: AnalysisJobStatus;

  /** ID of the garden being analyzed */
  gardenId: string;
}
