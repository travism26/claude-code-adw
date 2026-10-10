/**
 * Grow AI Analysis API Client
 *
 * API functions for AI-powered grow analysis operations:
 * - Grow analysis (general, nutrients, diagnosis, optimization, harvest_timing)
 * - Photo deficiency detection
 * - Nutrient recommendations
 * - Analysis history and usage tracking
 *
 * All functions use the ApiClient singleton for authenticated requests.
 * Never import these functions directly in components - use hooks instead.
 */

import { ApiClient } from '../utils/api';
import type {
  GrowAnalysis,
  RequestAnalysisRequest,
  RequestAnalysisResponse,
  RequestPhotoAnalysisRequest,
  RequestPhotoAnalysisResponse,
  AnalysisHistoryFilters,
  AnalysisHistoryResponse,
  GrowAnalysisUsageResponse,
  GrowCanAnalyzeResponse,
} from '../types';

const apiClient = ApiClient.getInstance();

/**
 * Request a grow analysis
 * Queues an AI analysis job (general, nutrients, diagnosis, optimization, or harvest_timing)
 * Returns job ID and status - completion notification via WebSocket
 *
 * @param growId - UUID of the grow to analyze
 * @param request - Analysis request parameters (type, context, etc.)
 * @returns Promise resolving to job info with remaining analysis count
 */
export const requestGrowAnalysis = async (
  growId: string,
  request: RequestAnalysisRequest
): Promise<RequestAnalysisResponse> => {
  const response = await apiClient.request<RequestAnalysisResponse>(
    `/grows/${growId}/analyze`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
  return response;
};

/**
 * Request photo analysis for deficiency detection
 * Analyzes a photo from a grow log for plant health issues
 * Returns job ID and status - completion notification via WebSocket
 *
 * @param logId - UUID of the grow log containing the photo
 * @param request - Photo analysis request (photoId, optional context)
 * @returns Promise resolving to job info with remaining analysis count
 */
export const analyzeGrowPhoto = async (
  logId: string,
  request: RequestPhotoAnalysisRequest
): Promise<RequestPhotoAnalysisResponse> => {
  const response = await apiClient.request<RequestPhotoAnalysisResponse>(
    `/grow-logs/${logId}/analyze-photo`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
  return response;
};

/**
 * Fetch analysis history for a grow
 * Returns paginated list of past analyses ordered by date (newest first)
 *
 * @param growId - UUID of the grow
 * @param filters - Optional filters for analysis type, pagination
 * @returns Promise resolving to analysis history response
 */
export const getAnalysisHistory = async (
  growId: string,
  filters?: AnalysisHistoryFilters
): Promise<AnalysisHistoryResponse> => {
  const params = new URLSearchParams();
  params.append('growId', growId);

  if (filters?.analysisType) {
    params.append('analysisType', filters.analysisType);
  }
  if (filters?.limit) {
    params.append('limit', filters.limit.toString());
  }
  if (filters?.offset) {
    params.append('offset', filters.offset.toString());
  }

  const queryString = params.toString();
  const endpoint = `/grow-analyses?${queryString}`;

  const response = await apiClient.request<AnalysisHistoryResponse>(endpoint);
  return response;
};

/**
 * Get analysis usage statistics for today
 * Returns counts and remaining quota for grow and photo analyses
 *
 * @returns Promise resolving to usage statistics
 */
export const getAnalysisUsageToday = async (): Promise<GrowAnalysisUsageResponse> => {
  const response = await apiClient.request<GrowAnalysisUsageResponse>('/analysis-usage/today');
  return response;
};

/**
 * Check if user can perform an analysis
 * Checks daily limits and pending analysis status
 *
 * @param analysisType - Optional analysis type to check
 * @returns Promise resolving to can analyze result with reason if blocked
 */
export const canAnalyze = async (analysisType?: string): Promise<GrowCanAnalyzeResponse> => {
  const params = new URLSearchParams();
  if (analysisType) {
    params.append('analysisType', analysisType);
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/analysis-usage/can-analyze?${queryString}` : '/analysis-usage/can-analyze';

  const response = await apiClient.request<GrowCanAnalyzeResponse>(endpoint);
  return response;
};

/**
 * Get a single analysis by ID
 * Useful for refreshing analysis details after WebSocket notification
 *
 * @param analysisId - UUID of the analysis
 * @returns Promise resolving to GrowAnalysis object
 */
export const getAnalysis = async (analysisId: string): Promise<GrowAnalysis> => {
  const response = await apiClient.request<GrowAnalysis>(`/grow-analyses/${analysisId}`);
  return response;
};
