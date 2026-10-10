/**
 * GrowEnvironment API Client
 *
 * API functions for grow environment CRUD operations.
 * All functions use the ApiClient singleton for authenticated requests.
 * Never import these functions directly in components - use hooks instead.
 */

import { ApiClient } from "../utils/api";
import type {
  GrowEnvironment,
  CreateGrowEnvironmentRequest,
  UpdateGrowEnvironmentRequest,
  GrowEnvironmentFilters,
  GrowEnvironmentsResponse,
  GrowEnvironmentResponse,
  CapacityCheckResult,
  CheckCapacityRequest,
  EnvironmentCapacityInfo,
} from "../types/growEnvironment";
import type { Grow } from "../types/grow";

const apiClient = ApiClient.getInstance();

/**
 * Fetch all grow environments for the authenticated user
 * Supports filtering by type, active status, and pagination
 *
 * @param filters - Optional filters for type, is_active, name, pagination
 * @returns Promise resolving to GrowEnvironmentsResponse with environments array and metadata
 */
export const getGrowEnvironments = async (
  filters?: GrowEnvironmentFilters
): Promise<GrowEnvironmentsResponse> => {
  const params = new URLSearchParams();

  if (filters?.type) {
    params.append("type", filters.type);
  }
  if (filters?.is_active !== undefined) {
    params.append("is_active", filters.is_active.toString());
  }
  if (filters?.name) {
    params.append("name", filters.name);
  }
  if (filters?.limit) {
    params.append("limit", filters.limit.toString());
  }
  if (filters?.offset) {
    params.append("offset", filters.offset.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/grow-environments?${queryString}` : "/grow-environments";

  const response = await apiClient.request<GrowEnvironmentsResponse>(endpoint);
  return response;
};

/**
 * Fetch a single grow environment by ID
 *
 * @param id - GrowEnvironment UUID
 * @returns Promise resolving to GrowEnvironment object
 */
export const getGrowEnvironment = async (id: string): Promise<GrowEnvironment> => {
  const response = await apiClient.request<GrowEnvironmentResponse>(`/grow-environments/${id}`);
  return response.data;
};

/**
 * Create a new grow environment
 *
 * @param data - Environment creation data (name, type required)
 * @returns Promise resolving to created GrowEnvironment object
 */
export const createGrowEnvironment = async (
  data: CreateGrowEnvironmentRequest
): Promise<GrowEnvironment> => {
  const response = await apiClient.request<GrowEnvironmentResponse>("/grow-environments", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.data;
};

/**
 * Update an existing grow environment
 *
 * @param id - GrowEnvironment UUID
 * @param data - Partial environment data to update
 * @returns Promise resolving to updated GrowEnvironment object
 */
export const updateGrowEnvironment = async (
  id: string,
  data: UpdateGrowEnvironmentRequest
): Promise<GrowEnvironment> => {
  const response = await apiClient.request<GrowEnvironmentResponse>(`/grow-environments/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return response.data;
};

/**
 * Delete a grow environment
 *
 * @param id - GrowEnvironment UUID
 * @returns Promise resolving when deletion is complete
 */
export const deleteGrowEnvironment = async (id: string): Promise<void> => {
  await apiClient.request(`/grow-environments/${id}`, { method: "DELETE" });
};

/**
 * Fetch all grows assigned to a specific environment
 *
 * @param id - GrowEnvironment UUID
 * @returns Promise resolving to array of Grow objects
 */
export const getEnvironmentGrows = async (id: string): Promise<Grow[]> => {
  const response = await apiClient.request<{ grows: Grow[] }>(
    `/grow-environments/${id}/grows`
  );
  return response.grows;
};

/**
 * Check projected capacity for an environment
 *
 * This function calculates what the capacity status would be if the user
 * adds a specified number of plants to an environment. It performs a
 * "what-if" projection without actually adding plants.
 *
 * The result includes capacity status (normal/warning/over), utilization
 * percentage, and warning messages. Importantly, the `allowed` field is
 * always `true` - capacity warnings are informational only and never
 * block user actions.
 *
 * @param environmentId - UUID of the environment to check
 * @param additionalPlants - Number of plants to add (for projection)
 * @returns Promise resolving to CapacityCheckResult with projected capacity metrics
 *
 * @example
 * ```ts
 * const result = await checkCapacity('env-123', 5);
 * if (result.status === 'warning') {
 *   console.log(result.warnings); // Display warnings to user
 * }
 * // User can still proceed regardless of status
 * ```
 */
export const checkCapacity = async (
  environmentId: string,
  additionalPlants: number
): Promise<CapacityCheckResult> => {
  const body: CheckCapacityRequest = {
    environmentId,
    additionalPlants,
  };

  const response = await apiClient.request<{ data: CapacityCheckResult }>(
    "/grow-environments/check-capacity",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  return response.data;
};

/**
 * Get current capacity information for a single environment
 *
 * Fetches the current capacity status, plant count, and utilization
 * percentage for an environment without projection. This is useful for
 * displaying current state in environment lists and cards.
 *
 * @param environmentId - UUID of the environment
 * @returns Promise resolving to EnvironmentCapacityInfo with current capacity data
 *
 * @example
 * ```ts
 * const capacity = await getEnvironmentCapacity('env-123');
 * console.log(`${capacity.currentPlants}/${capacity.maxPlants} plants`);
 * console.log(`Status: ${capacity.capacityStatus}`);
 * ```
 */
export const getEnvironmentCapacity = async (
  environmentId: string
): Promise<EnvironmentCapacityInfo> => {
  const response = await apiClient.request<{ data: EnvironmentCapacityInfo }>(
    `/grow-environments/${environmentId}/capacity`
  );

  return response.data;
};
