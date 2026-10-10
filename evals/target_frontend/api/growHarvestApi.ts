// Grow harvest API client
import { ApiClient } from "../utils/api";
import type { HarvestInput, HarvestResponse } from "../types/growHarvest";

const apiClient = ApiClient.getInstance();

export const fetchHarvest = (growId: string): Promise<HarvestResponse> =>
  apiClient.request<HarvestResponse>(`/grows/${growId}/harvest`);

export const createHarvest = (
  growId: string,
  data: HarvestInput
): Promise<HarvestResponse> =>
  apiClient.request<HarvestResponse>(`/grows/${growId}/harvest`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateHarvest = (
  growId: string,
  data: HarvestInput
): Promise<HarvestResponse> =>
  apiClient.request<HarvestResponse>(`/grows/${growId}/harvest`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
