// Companion Planting API queries
import { ApiClient } from "../utils/api";
import type { CompanionRelationship } from "../types";

const apiClient = ApiClient.getInstance();

export const fetchCompanions = async (
  plantProfileId: string
): Promise<CompanionRelationship[]> => {
  const response = await apiClient.request<{ companions: CompanionRelationship[] }>(
    `/companions/${plantProfileId}`
  );
  return response.companions;
};

// Optionally fetch all companion relationships at once for caching
export const fetchAllCompanions = async (): Promise<CompanionRelationship[]> => {
  const response = await apiClient.request<{ companions: CompanionRelationship[] }>(
    "/companions"
  );
  return response.companions;
};
