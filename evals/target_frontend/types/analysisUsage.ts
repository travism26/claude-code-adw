/**
 * Analysis Usage Types
 *
 * Type definitions for AI analysis daily limit tracking system
 */

/**
 * Usage statistics for a user's AI analysis usage
 */
export interface AnalysisUsage {
  /** Number of analyses used today */
  used: number;
  /** Number of bonus analyses granted by admin */
  bonus: number;
  /** Total analyses available (default limit + bonus) */
  total: number;
  /** Number of analyses remaining for today */
  remaining: number;
}

/**
 * Response from checking if user can analyze
 */
export interface CanAnalyzeResponse {
  /** Whether the user can perform an analysis */
  canAnalyze: boolean;
  /** Number of analyses remaining */
  remaining: number;
  /** Whether an analysis is currently pending */
  hasPending: boolean;
  /** Reason why user cannot analyze (if applicable) */
  reason?: 'feature_disabled' | 'analysis_pending' | 'limit_reached' | 'user_not_found';
}
