"use client";

/**
 * React Query Hooks for Garden Suggestions
 *
 * Provides hooks for fetching and managing AI-generated garden analysis and suggestions.
 * Follows the 4-layer API integration pattern.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGardenAnalysis, triggerGardenAnalysis } from "../api/suggestionApi";
import type { GardenAnalysis, AnalysisJobResponse } from "../types";

/**
 * Query key factory for garden suggestions
 * Provides hierarchical cache keys for React Query
 */
export const suggestionKeys = {
  all: ["suggestions"] as const,
  lists: () => [...suggestionKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...suggestionKeys.lists(), filters] as const,
  details: () => [...suggestionKeys.all, "detail"] as const,
  detail: (gardenId: string) => [...suggestionKeys.details(), gardenId] as const,
};

/**
 * Hook for fetching garden analysis and AI suggestions
 *
 * @param gardenId - The ID of the garden to analyze, or null to disable the query
 * @returns React Query result with GardenAnalysis data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useGardenAnalysis(gardenId);
 * if (isLoading) return <Spinner />;
 * if (error) return <Alert status="error">{error.message}</Alert>;
 * return <div>Score: {data?.overallScore}</div>;
 * ```
 */
export function useGardenAnalysis(gardenId: string | null) {
  return useQuery<GardenAnalysis | null, Error>({
    queryKey: suggestionKeys.detail(gardenId || ""),
    queryFn: async () => {
      try {
        return await getGardenAnalysis(gardenId!);
      } catch (error: any) {
        // Treat 404 as "no analysis exists yet" - return null instead of throwing
        if (error?.status === 404) {
          return null;
        }
        // Re-throw other errors to trigger error state
        throw error;
      }
    },
    enabled: !!gardenId,
    staleTime: 5 * 60 * 1000, // 5 minutes - avoid excessive API calls
    retry: false, // Don't retry on errors (user can manually refresh)
  });
}

/**
 * Hook for triggering manual garden analysis
 *
 * This mutation triggers an async analysis job on the backend.
 * The backend returns 202 Accepted with a jobId immediately.
 *
 * @returns React Query mutation result for triggering analysis
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useTriggerAnalysis();
 *
 * const handleAnalyze = () => {
 *   mutate(gardenId, {
 *     onSuccess: (data) => {
 *       toast({ title: "Analysis started", description: `Job ID: ${data.jobId}` });
 *     },
 *     onError: (error) => {
 *       toast({ title: "Error", description: error.message, status: "error" });
 *     }
 *   });
 * };
 * ```
 */
export function useTriggerAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<AnalysisJobResponse, Error, string>({
    mutationFn: (gardenId: string) => triggerGardenAnalysis(gardenId),
    onSuccess: (data, gardenId) => {
      // Invalidate garden analysis query to trigger refetch when analysis completes
      queryClient.invalidateQueries({
        queryKey: suggestionKeys.detail(gardenId),
      });
    },
  });
}
