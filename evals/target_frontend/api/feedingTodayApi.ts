// "Feeding due today" agenda API client.
import { ApiClient } from "../utils/api";
import type { FeedingTodayResponse } from "../types/feedingToday";

const apiClient = ApiClient.getInstance();

export const fetchFeedingToday = (): Promise<FeedingTodayResponse> =>
  apiClient.request<FeedingTodayResponse>("/grows/feeding/today");
