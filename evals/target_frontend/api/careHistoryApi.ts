// Care History API
import { ApiClient } from "../utils/api";
import type {
  CareHistoryEntry,
  CreateCareHistoryRequest,
  CareHistoryFilters,
  CareHistoryResponse,
} from "../types";

const apiClient = ApiClient.getInstance();

export const logCareAction = async (
  plantId: string,
  actionType: string,
  notes?: string,
  actionDate?: Date
): Promise<CareHistoryEntry> => {
  const payload: CreateCareHistoryRequest = {
    plant_id: plantId,
    action_type: actionType as any,
    notes,
    action_date: actionDate?.toISOString(),
  };

  const response = await apiClient.request<{ careHistory: CareHistoryEntry }>(
    "/care-history",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return response.careHistory;
};

export const fetchCareHistory = async (
  plantId?: string,
  filters?: CareHistoryFilters
): Promise<CareHistoryResponse> => {
  const queryParams = new URLSearchParams();

  if (plantId) queryParams.append("plantId", plantId);
  if (filters?.actionType)
    queryParams.append("actionType", filters.actionType);
  if (filters?.startDate) queryParams.append("startDate", filters.startDate);
  if (filters?.endDate) queryParams.append("endDate", filters.endDate);
  if (filters?.limit) queryParams.append("limit", filters.limit.toString());

  const queryString = queryParams.toString();
  const endpoint = `/care-history${queryString ? `?${queryString}` : ""}`;

  const response = await apiClient.request<CareHistoryResponse>(endpoint);
  return response;
};

export const deleteCareHistoryEntry = async (id: string): Promise<void> => {
  await apiClient.request(`/care-history/${id}`, { method: "DELETE" });
};
