/**
 * Suggestion API Client
 *
 * API client module for garden analysis and AI-generated suggestions.
 * Follows the 4-layer API integration pattern.
 */

import { ApiClient } from "../utils/api";
import type { GardenAnalysis, AnalysisJobResponse } from "../types";

const apiClient = ApiClient.getInstance();

/**
 * Triggers AI-generated analysis for a specific garden.
 *
 * This endpoint queues an async job and returns immediately with job status.
 * The backend returns 202 Accepted with a jobId.
 *
 * TODO: Add WebSocket listener for real-time job status updates
 *
 * @param gardenId - The ID of the garden to analyze
 * @returns Promise resolving to AnalysisJobResponse with jobId and status
 * @throws ApiError if the request fails or user lacks permission
 */
export async function triggerGardenAnalysis(
  gardenId: string
): Promise<AnalysisJobResponse> {
  const response = await apiClient.request<AnalysisJobResponse>(
    `/gardens/${gardenId}/analyze`,
    {
      method: "POST",
    }
  );

  return response;
}

/**
 * Fetches AI-generated analysis results for a specific garden.
 *
 * Calls the backend GET /gardens/:id/analysis endpoint to retrieve
 * the most recent analysis for the specified garden.
 *
 * @param gardenId - The ID of the garden to fetch analysis for
 * @returns Promise resolving to GardenAnalysis with suggestions, score, and summary
 * @throws ApiError if the request fails, user lacks permission, or no analysis exists (404)
 */
export async function getGardenAnalysis(
  gardenId: string
): Promise<GardenAnalysis> {
  const response = await apiClient.request<GardenAnalysis>(
    `/gardens/${gardenId}/analysis`,
    {
      method: "GET",
    }
  );

  return response;
}
