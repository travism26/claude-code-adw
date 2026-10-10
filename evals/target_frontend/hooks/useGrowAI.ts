"use client";

/**
 * Grow AI Analysis React Query Hooks
 *
 * Custom hooks for AI analysis operations using TanStack Query:
 * - Grow analysis (general, nutrients, diagnosis, optimization, harvest_timing)
 * - Photo deficiency detection
 * - Nutrient recommendations
 * - Analysis history and usage tracking
 *
 * Includes WebSocket integration for real-time analysis completion events.
 * Components should use these hooks, never import API functions directly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import {
  requestGrowAnalysis,
  analyzeGrowPhoto,
  getAnalysisHistory,
  getAnalysisUsageToday,
  canAnalyze,
} from "../api/growAIApi";
import type {
  GrowAnalysis,
  RequestAnalysisRequest,
  RequestAnalysisResponse,
  RequestPhotoAnalysisRequest,
  RequestPhotoAnalysisResponse,
  AnalysisHistoryFilters,
  AnalysisHistoryResponse,
  GrowAnalysisUsageResponse,
  GrowCanAnalyzeResponse,
  GrowAnalysisCompletedEvent,
  GrowPhotoAnalysisCompletedEvent,
  GrowNutrientRecommendationCompletedEvent,
} from "../types";
import { growKeys } from "./useGrows";

/**
 * Hierarchical query key factory for grow AI features
 * Enables precise cache invalidation at different levels
 */
export const growAIKeys = {
  all: ["grow-ai"] as const,
  analyses: () => [...growAIKeys.all, "analyses"] as const,
  history: (growId: string, filters?: AnalysisHistoryFilters) =>
    [...growAIKeys.analyses(), "history", growId, filters] as const,
  usage: () => [...growAIKeys.all, "usage"] as const,
  usageToday: () => [...growAIKeys.usage(), "today"] as const,
  canAnalyze: (analysisType?: string) =>
    [...growAIKeys.all, "can-analyze", analysisType] as const,
};

/**
 * Hook for fetching analysis history for a grow
 * Returns paginated list of past analyses ordered by date (newest first)
 *
 * @param growId - Grow UUID (null to disable query)
 * @param filters - Optional filters for analysis type, pagination
 * @returns Query result with analysis history
 */
export const useAnalysisHistory = (
  growId: string | null,
  filters?: AnalysisHistoryFilters
) => {
  return useQuery<AnalysisHistoryResponse, Error>({
    queryKey: growAIKeys.history(growId!, filters),
    queryFn: () => getAnalysisHistory(growId!, filters),
    enabled: !!growId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

/**
 * Hook for fetching analysis usage statistics for today
 * Returns counts and remaining quota for grow and photo analyses
 *
 * @returns Query result with usage statistics
 */
export const useAnalysisUsage = () => {
  return useQuery<GrowAnalysisUsageResponse, Error>({
    queryKey: growAIKeys.usageToday(),
    queryFn: getAnalysisUsageToday,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook for checking if user can perform an analysis
 * Checks daily limits and pending analysis status
 *
 * @param analysisType - Optional analysis type to check
 * @returns Query result with can analyze status
 */
export const useCanAnalyze = (analysisType?: string) => {
  return useQuery<GrowCanAnalyzeResponse, Error>({
    queryKey: growAIKeys.canAnalyze(analysisType),
    queryFn: () => canAnalyze(analysisType),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook for requesting a grow analysis
 * Queues an AI analysis job and returns job ID
 * Invalidates analysis history and usage queries on success
 *
 * @returns Mutation function and state
 */
export const useRequestGrowAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      growId,
      request,
    }: {
      growId: string;
      request: RequestAnalysisRequest;
    }) => requestGrowAnalysis(growId, request),
    onSuccess: (_, variables) => {
      // Invalidate history to show new pending analysis
      queryClient.invalidateQueries({
        queryKey: growAIKeys.analyses(),
      });
      // Invalidate usage to update remaining count
      queryClient.invalidateQueries({
        queryKey: growAIKeys.usage(),
      });
      // Invalidate can analyze checks
      queryClient.invalidateQueries({
        queryKey: growAIKeys.canAnalyze(),
      });
      // Invalidate the grow detail to update any badges or status
      queryClient.invalidateQueries({
        queryKey: growKeys.detail(variables.growId),
      });
    },
  });
};

/**
 * Hook for requesting photo analysis
 * Analyzes a photo for deficiency detection
 * Invalidates usage queries on success
 *
 * @returns Mutation function and state
 */
export const useRequestPhotoAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      logId,
      request,
    }: {
      logId: string;
      request: RequestPhotoAnalysisRequest;
    }) => analyzeGrowPhoto(logId, request),
    onSuccess: () => {
      // Invalidate usage to update remaining count
      queryClient.invalidateQueries({
        queryKey: growAIKeys.usage(),
      });
      // Invalidate can analyze checks
      queryClient.invalidateQueries({
        queryKey: growAIKeys.canAnalyze(),
      });
    },
  });
};

/**
 * Hook for subscribing to grow analysis completion events via WebSocket
 * Automatically invalidates analysis history and shows notifications
 *
 * @param growId - Grow UUID to listen for
 * @param onComplete - Optional callback when analysis completes
 */
export const useGrowAnalysisWebSocket = (
  growId: string | null,
  onComplete?: (event: GrowAnalysisCompletedEvent) => void
) => {
  const queryClient = useQueryClient();
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected || !growId) return;

    const unsubscribe = subscribe(
      "grow_analysis_completed",
      (event: GrowAnalysisCompletedEvent) => {
        if (event.growId === growId) {
          // Invalidate analysis history to show new result
          queryClient.invalidateQueries({
            queryKey: growAIKeys.analyses(),
          });
          // Invalidate usage to update remaining count
          queryClient.invalidateQueries({
            queryKey: growAIKeys.usage(),
          });
          // Invalidate can analyze checks
          queryClient.invalidateQueries({
            queryKey: growAIKeys.canAnalyze(),
          });

          // Call custom callback if provided
          if (onComplete) {
            onComplete(event);
          }
        }
      }
    );

    return unsubscribe;
  }, [growId, isConnected, subscribe, queryClient, onComplete]);
};

/**
 * Hook for subscribing to photo analysis completion events via WebSocket
 *
 * @param onComplete - Callback when photo analysis completes
 */
export const usePhotoAnalysisWebSocket = (
  onComplete?: (event: GrowPhotoAnalysisCompletedEvent) => void
) => {
  const queryClient = useQueryClient();
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe(
      "grow_photo_analysis_completed",
      (event: GrowPhotoAnalysisCompletedEvent) => {
        // Invalidate usage to update remaining count
        queryClient.invalidateQueries({
          queryKey: growAIKeys.usage(),
        });
        // Invalidate can analyze checks
        queryClient.invalidateQueries({
          queryKey: growAIKeys.canAnalyze(),
        });

        // Call custom callback if provided
        if (onComplete) {
          onComplete(event);
        }
      }
    );

    return unsubscribe;
  }, [isConnected, subscribe, queryClient, onComplete]);
};

/**
 * Hook for subscribing to nutrient recommendation completion events via WebSocket
 *
 * @param growId - Grow UUID to listen for
 * @param onComplete - Optional callback when recommendation completes
 */
export const useNutrientRecommendationWebSocket = (
  growId: string | null,
  onComplete?: (event: GrowNutrientRecommendationCompletedEvent) => void
) => {
  const queryClient = useQueryClient();
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected || !growId) return;

    const unsubscribe = subscribe(
      "grow_nutrient_recommendation_completed",
      (event: GrowNutrientRecommendationCompletedEvent) => {
        if (event.growId === growId) {
          // Invalidate analysis history (recommendations stored as analyses)
          queryClient.invalidateQueries({
            queryKey: growAIKeys.analyses(),
          });
          // Invalidate usage to update remaining count
          queryClient.invalidateQueries({
            queryKey: growAIKeys.usage(),
          });
          // Invalidate can analyze checks
          queryClient.invalidateQueries({
            queryKey: growAIKeys.canAnalyze(),
          });

          // Call custom callback if provided
          if (onComplete) {
            onComplete(event);
          }
        }
      }
    );

    return unsubscribe;
  }, [growId, isConnected, subscribe, queryClient, onComplete]);
};
