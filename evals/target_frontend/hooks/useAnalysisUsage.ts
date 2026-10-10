"use client";

/**
 * Analysis Usage Hooks
 *
 * React Query hooks for managing AI analysis daily limit tracking.
 * Provides hooks for fetching usage stats and checking analysis availability.
 */

import { useQuery } from "@tanstack/react-query";
import { getUsageToday, checkCanAnalyze } from "../api/analysisUsageApi";
import type { AnalysisUsage, CanAnalyzeResponse } from "../types";

/**
 * Query keys for analysis usage
 * Hierarchical structure for efficient cache invalidation
 */
export const analysisUsageKeys = {
  all: ['analysisUsage'] as const,
  today: () => [...analysisUsageKeys.all, 'today'] as const,
  canAnalyze: (gardenId?: string) => [...analysisUsageKeys.all, 'canAnalyze', gardenId] as const,
};

/**
 * Hook for fetching today's usage statistics
 *
 * @returns Query result with usage stats (used, bonus, total, remaining)
 */
export const useAnalysisUsageToday = () => {
  return useQuery<AnalysisUsage, Error>({
    queryKey: analysisUsageKeys.today(),
    queryFn: getUsageToday,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};

/**
 * Hook for checking if user can perform an analysis
 *
 * @param gardenId - Optional garden ID for per-garden pending check
 * @returns Query result with can-analyze status and reasons
 */
export const useCanAnalyze = (gardenId?: string) => {
  return useQuery<CanAnalyzeResponse, Error>({
    queryKey: analysisUsageKeys.canAnalyze(gardenId),
    queryFn: () => checkCanAnalyze(gardenId),
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
