// Plant Profile API queries
import { ApiClient } from "../utils/api";
import type {
  PlantProfile,
  PlantProfileFilters,
  PlantProfilesResponse,
  PlantProfileTip,
} from "../types";

const apiClient = ApiClient.getInstance();

export const fetchPlantProfiles = async (
  filters?: PlantProfileFilters
): Promise<PlantProfilesResponse> => {
  const queryParams = new URLSearchParams();

  if (filters?.type) queryParams.append("type", filters.type);
  if (filters?.difficulty) queryParams.append("difficulty", filters.difficulty);
  if (filters?.zone) queryParams.append("zone", filters.zone.toString());
  if (filters?.search) queryParams.append("search", filters.search);
  if (filters?.page) queryParams.append("page", filters.page.toString());
  if (filters?.limit) queryParams.append("limit", filters.limit.toString());

  const queryString = queryParams.toString();
  const endpoint = `/plant-profiles${queryString ? `?${queryString}` : ""}`;

  const response = await apiClient.request<PlantProfilesResponse>(endpoint);
  return response;
};

export const searchPlantProfiles = async (
  query: string
): Promise<PlantProfile[]> => {
  const response = await apiClient.request<{ plantProfiles: PlantProfile[] }>(
    `/plant-profiles/search?q=${encodeURIComponent(query)}`
  );
  return response.plantProfiles;
};

export const fetchPlantProfile = async (id: string): Promise<PlantProfile> => {
  const response = await apiClient.request<{ plantProfile: PlantProfile }>(
    `/plant-profiles/${id}`
  );
  return response.plantProfile;
};

export const fetchPlantProfileTips = async (
  id: string,
  zone?: number
): Promise<PlantProfileTip[]> => {
  const endpoint = zone
    ? `/plant-profiles/${id}/tips?zone=${zone}`
    : `/plant-profiles/${id}/tips`;

  const response = await apiClient.request<{ tips: PlantProfileTip[] }>(
    endpoint
  );
  return response.tips;
};
