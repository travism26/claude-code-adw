// Feed-event API client (plan ↔ log over a grow's weekly schedule)
import { ApiClient } from "../utils/api";
import type {
  FeedEventsResponse,
  FeedEventResponse,
  MarkFeedEventInput,
} from "../types/feedEvent";

const apiClient = ApiClient.getInstance();

export const fetchFeedEvents = (growId: string): Promise<FeedEventsResponse> =>
  apiClient.request<FeedEventsResponse>(`/grows/${growId}/feed-events`);

export const markFeedEvent = (
  growId: string,
  weekNumber: number,
  data: MarkFeedEventInput
): Promise<FeedEventResponse> =>
  apiClient.request<FeedEventResponse>(
    `/grows/${growId}/feed-events/${weekNumber}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
