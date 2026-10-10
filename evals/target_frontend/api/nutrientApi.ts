/**
 * Nutrient API Client
 *
 * API functions for nutrient catalog and grow-nutrient relationship operations.
 * All functions use the ApiClient singleton for authenticated requests.
 * Never import these functions directly in components - use hooks instead.
 */

import { ApiClient } from "../utils/api";
import type {
  Nutrient,
  GrowNutrient,
  NutrientFilters,
  CreateGrowNutrientRequest,
  UpdateGrowNutrientRequest,
  NutrientsResponse,
  GrowNutrientsResponse,
} from "../types";

const apiClient = ApiClient.getInstance();

/**
 * Fetch all nutrients (system + user's custom nutrients)
 * Supports filtering by brand, type, and organic status
 *
 * @param filters - Optional filters for brand, type, is_organic, pagination
 * @returns Promise resolving to NutrientsResponse with nutrients array
 */
export const getNutrients = async (
  filters?: NutrientFilters
): Promise<NutrientsResponse> => {
  const params = new URLSearchParams();

  if (filters?.brand) {
    params.append("brand", filters.brand);
  }
  if (filters?.type) {
    params.append("type", filters.type);
  }
  if (filters?.is_organic !== undefined) {
    params.append("is_organic", filters.is_organic.toString());
  }
  if (filters?.limit) {
    params.append("limit", filters.limit.toString());
  }
  if (filters?.offset) {
    params.append("offset", filters.offset.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/nutrients?${queryString}` : "/nutrients";

  const response = await apiClient.request<NutrientsResponse>(endpoint);
  return response;
};

/**
 * Fetch nutrients assigned to a specific grow
 *
 * @param growId - Grow UUID
 * @returns Promise resolving to GrowNutrientsResponse with grow_nutrients array
 */
export const getGrowNutrients = async (
  growId: string
): Promise<GrowNutrientsResponse> => {
  const response = await apiClient.request<GrowNutrientsResponse>(
    `/grows/${growId}/nutrients`
  );
  return response;
};

/**
 * Add a nutrient to a grow with dosage and application configuration
 *
 * @param growId - Grow UUID
 * @param data - Nutrient configuration (nutrient_id, dosage, frequency, phase)
 * @returns Promise resolving to created GrowNutrient object
 */
export const addGrowNutrient = async (
  growId: string,
  data: CreateGrowNutrientRequest
): Promise<GrowNutrient> => {
  const response = await apiClient.request<GrowNutrient>(
    `/grows/${growId}/nutrients`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return response;
};

/**
 * Update dosage, frequency, or phase for a grow-nutrient relationship
 *
 * @param id - GrowNutrient UUID
 * @param data - Updated configuration data
 * @returns Promise resolving to updated GrowNutrient object
 */
export const updateGrowNutrient = async (
  id: string,
  data: UpdateGrowNutrientRequest
): Promise<GrowNutrient> => {
  const response = await apiClient.request<GrowNutrient>(
    `/grow-nutrients/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return response;
};

/**
 * Remove a nutrient from a grow
 *
 * @param id - GrowNutrient UUID
 * @returns Promise resolving when deletion is complete
 */
export const removeGrowNutrient = async (id: string): Promise<void> => {
  await apiClient.request(`/grow-nutrients/${id}`, { method: "DELETE" });
};
