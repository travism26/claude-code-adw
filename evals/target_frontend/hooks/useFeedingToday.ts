"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFeedingToday } from "../api/feedingTodayApi";
import type { FeedingTodayResponse } from "../types/feedingToday";

export const feedingTodayKeys = {
  all: ["feedingToday"] as const,
};

export const useFeedingToday = () =>
  useQuery<FeedingTodayResponse, Error>({
    queryKey: feedingTodayKeys.all,
    queryFn: fetchFeedingToday,
  });
