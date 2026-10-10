/**
 * Nutrient Recommendation API Client
 *
 * API functions for nutrient recommendation operations.
 * All functions use the ApiClient singleton for authenticated requests.
 * Never import these functions directly in components - use hooks instead.
 */

import { ApiClient } from '../utils/api';
import type {
  NutrientRecommendationRequest,
  NutrientRecommendationQueueResponse,
  RecommendationType,
  OptimizationGoal,
} from '../types';

const apiClient = ApiClient.getInstance();

/**
 * Request nutrient recommendation for a grow
 *
 * Queues an AI-powered nutrient recommendation job for the specified grow.
 * Returns 202 Accepted with job ID. User will be notified via WebSocket when complete.
 *
 * @param growId - The grow ID to get recommendations for
 * @param request - Optional recommendation parameters (type, goal, deficiency)
 * @returns Promise resolving to queue response with jobId and status
 *
 * @example
 * ```typescript
 * // Request full feeding schedule optimized for yield
 * const response = await requestNutrientRecommendation('grow-123', {
 *   type: 'full_schedule',
 *   goal: 'yield'
 * });
 *
 * // Request deficiency fix
 * const response = await requestNutrientRecommendation('grow-123', {
 *   type: 'deficiency_fix',
 *   deficiency: 'Yellowing lower leaves, slow growth'
 * });
 * ```
 */
export const requestNutrientRecommendation = async (
  growId: string,
  request?: NutrientRecommendationRequest
): Promise<NutrientRecommendationQueueResponse> => {
  const payload = {
    type: 'nutrients', // Always 'nutrients' to route to nutrient recommendation service
    recommendationType: request?.type || 'full_schedule',
    goal: request?.goal || 'balanced',
    deficiency: request?.deficiency,
  };

  const response = await apiClient.request<NutrientRecommendationQueueResponse>(
    `/grows/${growId}/analyze`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  return response;
};

/**
 * Helper function to request full feeding schedule
 *
 * @param growId - The grow ID
 * @param goal - Optimization goal (yield, quality, or balanced)
 * @returns Promise resolving to queue response
 */
export const requestFullSchedule = async (
  growId: string,
  goal: OptimizationGoal = 'balanced'
): Promise<NutrientRecommendationQueueResponse> => {
  return requestNutrientRecommendation(growId, {
    type: 'full_schedule',
    goal,
  });
};

/**
 * Helper function to request phase adjustment
 *
 * @param growId - The grow ID
 * @returns Promise resolving to queue response
 */
export const requestPhaseAdjustment = async (
  growId: string
): Promise<NutrientRecommendationQueueResponse> => {
  return requestNutrientRecommendation(growId, {
    type: 'phase_adjustment',
  });
};

/**
 * Helper function to request deficiency fix
 *
 * @param growId - The grow ID
 * @param deficiency - Description of deficiency symptoms
 * @returns Promise resolving to queue response
 */
export const requestDeficiencyFix = async (
  growId: string,
  deficiency: string
): Promise<NutrientRecommendationQueueResponse> => {
  return requestNutrientRecommendation(growId, {
    type: 'deficiency_fix',
    deficiency,
  });
};

/**
 * Helper function to request optimization
 *
 * @param growId - The grow ID
 * @param goal - Optimization goal (yield, quality, or balanced)
 * @returns Promise resolving to queue response
 */
export const requestOptimization = async (
  growId: string,
  goal: OptimizationGoal = 'balanced'
): Promise<NutrientRecommendationQueueResponse> => {
  return requestNutrientRecommendation(growId, {
    type: 'optimization',
    goal,
  });
};
