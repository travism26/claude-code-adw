"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFeedEvents, markFeedEvent } from "../api/feedEventApi";
import type {
  FeedEventsResponse,
  MarkFeedEventInput,
} from "../types/feedEvent";

export const feedEventKeys = {
  grow: (growId: string) => ["feedEvents", growId] as const,
};

export const useFeedEvents = (growId: string | null) =>
  useQuery<FeedEventsResponse, Error>({
    queryKey: feedEventKeys.grow(growId!),
    queryFn: () => fetchFeedEvents(growId!),
    enabled: !!growId,
  });

export const useMarkFeedEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      growId,
      weekNumber,
      data,
    }: {
      growId: string;
      weekNumber: number;
      data: MarkFeedEventInput;
    }) => markFeedEvent(growId, weekNumber, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: feedEventKeys.grow(v.growId) });
      // A done/un-done event writes/removes a GrowLog → refresh the timeline
      // (root key catches every list/detail variant).
      qc.invalidateQueries({ queryKey: ["growLogs"] });
      qc.invalidateQueries({ queryKey: ["grows"] });
      // Today agenda reflects per-week status.
      qc.invalidateQueries({ queryKey: ["feedingToday"] });
    },
  });
};
