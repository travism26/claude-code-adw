"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSeasonalTips } from "../api/seasonalTipsApi";
import type { SeasonalTipsResponse } from "../types";

// Helper function to determine the current season based on month
const getCurrentSeason = (): string => {
  const month = new Date().getMonth() + 1; // getMonth() returns 0-11

  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
};

export const useSeasonalTips = (zone?: number, season?: string) => {
  // Use provided season or automatically determine current season
  const effectiveSeason = season || getCurrentSeason();

  return useQuery<SeasonalTipsResponse, Error>({
    queryKey: ["seasonalTips", zone, effectiveSeason],
    queryFn: () => fetchSeasonalTips(zone, effectiveSeason),
    // Enable the query only if we have a zone
    enabled: zone !== undefined,
  });
};
