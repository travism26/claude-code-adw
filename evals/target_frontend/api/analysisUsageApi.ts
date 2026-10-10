/**
 * Analysis Usage API Client
 *
 * Handles API requests for AI analysis daily limit tracking.
 * Follows the 4-layer architecture: Types → API Client → Hooks → Components
 */

import { ApiClient } from '../utils/api';
import type { AnalysisUsage, CanAnalyzeResponse } from '../types';

const apiClient = ApiClient.getInstance();

/**
 * Fetch usage statistics for today
 *
 * @returns Promise<AnalysisUsage> - Today's usage stats including used, bonus, total, and remaining counts
 */
export const getUsageToday = async (): Promise<AnalysisUsage> => {
  const response = await apiClient.request<AnalysisUsage>('/analysis-usage/today');
  return response;
};

/**
 * Check if user can perform an analysis
 *
 * @param gardenId - Optional garden ID for per-garden pending check
 * @returns Promise<CanAnalyzeResponse> - Analysis availability status with reasons
 */
export const checkCanAnalyze = async (gardenId?: string): Promise<CanAnalyzeResponse> => {
  const url = gardenId
    ? `/analysis-usage/can-analyze?gardenId=${encodeURIComponent(gardenId)}`
    : '/analysis-usage/can-analyze';
  const response = await apiClient.request<CanAnalyzeResponse>(url);
  return response;
};
