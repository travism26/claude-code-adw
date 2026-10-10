/**
 * Grow API Client
 *
 * API functions for cannabis grow tracking operations.
 * All functions use the ApiClient singleton for authenticated requests.
 * Never import these functions directly in components - use hooks instead.
 */

import { ApiClient } from "../utils/api";
import type {
  Grow,
  CreateGrowRequest,
  UpdateGrowRequest,
  UpdatePhaseRequest,
  GrowFilters,
  GrowsResponse,
} from "../types";

const apiClient = ApiClient.getInstance();

/**
 * Fetch all grows for the authenticated user
 * Supports filtering by phase and strain name
 *
 * @param filters - Optional filters for phase, strain name, pagination
 * @returns Promise resolving to GrowsResponse with grows array and metadata
 */
export const getGrows = async (filters?: GrowFilters): Promise<GrowsResponse> => {
  const params = new URLSearchParams();

  if (filters?.phase) {
    params.append("phase", filters.phase);
  }
  if (filters?.strain_name) {
    params.append("strain_name", filters.strain_name);
  }
  if (filters?.limit) {
    params.append("limit", filters.limit.toString());
  }
  if (filters?.offset) {
    params.append("offset", filters.offset.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/grows?${queryString}` : "/grows";

  const response = await apiClient.request<GrowsResponse>(endpoint);
  return response;
};

/**
 * Fetch a single grow by ID
 *
 * @param id - Grow UUID
 * @returns Promise resolving to Grow object
 */
export const getGrow = async (id: string): Promise<Grow> => {
  const response = await apiClient.request<Grow>(`/grows/${id}`);
  return response;
};

/**
 * Create a new grow
 *
 * @param data - Grow creation data (strain_name, plant_count, started_at required)
 * @returns Promise resolving to created Grow object
 */
export const createGrow = async (data: CreateGrowRequest): Promise<Grow> => {
  const response = await apiClient.request<Grow>("/grows", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response;
};

/**
 * Update an existing grow
 *
 * @param id - Grow UUID
 * @param data - Partial grow data to update
 * @returns Promise resolving to updated Grow object
 */
export const updateGrow = async (
  id: string,
  data: UpdateGrowRequest
): Promise<Grow> => {
  const response = await apiClient.request<Grow>(`/grows/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return response;
};

/**
 * Delete a grow
 *
 * @param id - Grow UUID
 * @returns Promise resolving when deletion is complete
 */
export const deleteGrow = async (id: string): Promise<void> => {
  await apiClient.request(`/grows/${id}`, { method: "DELETE" });
};

/**
 * Update the cultivation phase of a grow
 * Transitions grow to a new phase (germination -> vegetative -> flowering -> harvest)
 *
 * @param id - Grow UUID
 * @param data - Phase update data (new phase and optional phase_started_at)
 * @returns Promise resolving to updated Grow object
 */
export const updateGrowPhase = async (
  id: string,
  data: UpdatePhaseRequest
): Promise<Grow> => {
  const response = await apiClient.request<Grow>(`/grows/${id}/phase`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return response;
};
