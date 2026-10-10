"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  generateLayout,
  getLayoutGenerationStatus,
  applyLayout,
} from "../api/layoutApi";
import type {
  LayoutGenerationRequest,
  LayoutGenerationResponse,
  LayoutOption,
} from "../types";

/**
 * Hierarchical query keys for layout generation cache management
 */
const layoutKeys = {
  all: ['layouts'] as const,
  garden: (gardenId: string) => [...layoutKeys.all, 'garden', gardenId] as const,
  generation: (gardenId: string, jobId: string) =>
    [...layoutKeys.garden(gardenId), 'generation', jobId] as const,
};

/**
 * Query keys for gardens (to invalidate after applying layout)
 */
const gardenKeys = {
  all: ['gardens'] as const,
  detail: (gardenId: string) => [...gardenKeys.all, gardenId] as const,
};

/**
 * Hook for triggering layout generation
 * @param gardenId - The ID of the garden to generate layouts for
 * @returns Mutation object with mutate, mutateAsync, isPending, isError, error, data
 */
export function useGenerateLayout(gardenId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: LayoutGenerationRequest) =>
      generateLayout(gardenId, request),
    onSuccess: () => {
      // Invalidate garden queries to refresh any related data
      queryClient.invalidateQueries({ queryKey: layoutKeys.garden(gardenId) });
    },
  });
}

/**
 * Hook for polling layout generation job status
 * Automatically polls every 2 seconds while job is processing
 * Stops polling when job is completed or failed
 *
 * @param jobId - The BullMQ job identifier (null to disable polling)
 * @param gardenId - The ID of the garden (for query key)
 * @returns Query object with data, isLoading, error, refetch
 */
export function useLayoutGenerationStatus(jobId: string | null, gardenId: string) {
  return useQuery<LayoutGenerationResponse, Error>({
    queryKey: layoutKeys.generation(gardenId, jobId || ''),
    queryFn: () => getLayoutGenerationStatus(jobId!),
    enabled: !!jobId, // Only run when jobId exists
    refetchInterval: (query) => {
      // Stop polling when status is completed or failed
      const data = query.state.data;
      if (!data || data.status === 'completed' || data.status === 'failed') {
        return false;
      }
      // Poll every 2 seconds while processing
      return 2000;
    },
    retry: 3, // Retry up to 3 times on network failures
    retryDelay: 1000, // Wait 1 second between retries
  });
}

/**
 * Hook for applying a layout to a garden (creating plots)
 * Invalidates garden queries to refresh the canvas with new plots
 *
 * @param gardenId - The ID of the garden to apply the layout to
 * @returns Mutation object with mutate, mutateAsync, isPending, isError, error, data
 */
export function useApplyLayout(gardenId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutOption: LayoutOption) =>
      applyLayout(gardenId, layoutOption),
    onSuccess: () => {
      // Invalidate garden queries to refresh garden data and plots
      queryClient.invalidateQueries({ queryKey: gardenKeys.all });
      queryClient.invalidateQueries({ queryKey: gardenKeys.detail(gardenId) });
      // Also invalidate layout queries
      queryClient.invalidateQueries({ queryKey: layoutKeys.garden(gardenId) });
    },
  });
}
