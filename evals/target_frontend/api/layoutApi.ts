/**
 * Layout Generation API Client
 * Provides functions for triggering and polling AI-powered garden layout generation
 */

import { ApiClient } from '../utils/api';
import type {
  LayoutGenerationRequest,
  LayoutGenerationResponse,
} from '../types';

const apiClient = ApiClient.getInstance();

/**
 * Trigger layout generation for a garden
 * @param gardenId - The ID of the garden to generate layouts for
 * @param request - Layout generation parameters (plants, zones, preferences)
 * @returns Promise with job ID and initial status for polling
 */
export async function generateLayout(
  gardenId: string,
  request: LayoutGenerationRequest
): Promise<LayoutGenerationResponse> {
  const response = await apiClient.request<LayoutGenerationResponse>(
    `/gardens/${gardenId}/generate-layout`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
  return response;
}

/**
 * Poll layout generation job status
 * @param jobId - The BullMQ job identifier returned from generateLayout
 * @returns Promise with current job status and layouts when completed
 */
export async function getLayoutGenerationStatus(
  jobId: string
): Promise<LayoutGenerationResponse> {
  const response = await apiClient.request<LayoutGenerationResponse>(
    `/ai-tasks/${jobId}`
  );
  return response;
}

/**
 * Apply a generated layout to a garden (create plots from placements)
 * @param gardenId - The ID of the garden to apply the layout to
 * @param layoutOption - The selected layout option with all placements
 * @returns Promise with created plots and success message
 */
export async function applyLayout(
  gardenId: string,
  layoutOption: any
): Promise<{ message: string; plotsCreated: number; plots: any[] }> {
  const response = await apiClient.request<{
    message: string;
    plotsCreated: number;
    plots: any[];
  }>(`/gardens/${gardenId}/apply-layout`, {
    method: 'POST',
    body: JSON.stringify({ layoutOption }),
  });
  return response;
}
