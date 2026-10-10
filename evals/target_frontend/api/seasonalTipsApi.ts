// Seasonal Tips API
import { ApiClient } from "../utils/api";
import type { SeasonalTipsResponse } from "../types";

const apiClient = ApiClient.getInstance();

export const fetchSeasonalTips = async (
  zone?: number,
  season?: string
): Promise<SeasonalTipsResponse> => {
  const queryParams = new URLSearchParams();

  if (zone) queryParams.append("zone", zone.toString());
  if (season) queryParams.append("season", season);

  const queryString = queryParams.toString();
  const endpoint = `/seasonal-tips${queryString ? `?${queryString}` : ""}`;

  const response = await apiClient.request<SeasonalTipsResponse>(endpoint);
  return response;
};
