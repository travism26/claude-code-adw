"use client";

/**
 * Grow Tracking React Query Hooks
 *
 * Custom hooks for grow CRUD operations using TanStack Query.
 * Implements hierarchical query key pattern and cache invalidation.
 * Components should use these hooks, never import API functions directly.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  getGrows,
  getGrow,
  createGrow,
  updateGrow,
  deleteGrow,
  updateGrowPhase,
} from "../api/growApi";
import type {
  Grow,
  CreateGrowRequest,
  UpdateGrowRequest,
  UpdatePhaseRequest,
  GrowFilters,
  GrowsResponse,
} from "../types";

/**
 * Hierarchical query key factory for grows
 * Enables precise cache invalidation at different levels
 */
export const growKeys = {
  all: ["grows"] as const,
  lists: () => [...growKeys.all, "list"] as const,
  list: (filters?: GrowFilters) => [...growKeys.lists(), filters] as const,
  details: () => [...growKeys.all, "detail"] as const,
  detail: (id: string) => [...growKeys.details(), id] as const,
};

/**
 * Hook for fetching all grows with optional filters
 * Supports filtering by phase, strain name, and pagination
 *
 * @param filters - Optional filters for phase, strain name, limit, offset
 * @returns Query result with grows array and metadata
 */
export const useGrows = (filters?: GrowFilters) => {
  return useQuery<GrowsResponse, Error>({
    queryKey: growKeys.list(filters),
    queryFn: () => getGrows(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Keep the previous page visible while the next page loads so paginated
    // navigation doesn't flash the skeleton state.
    placeholderData: keepPreviousData,
  });
};

/**
 * Hook for fetching a single grow by ID
 *
 * @param id - Grow UUID (null to disable query)
 * @returns Query result with grow object
 */
export const useGrow = (id: string | null) => {
  return useQuery<Grow, Error>({
    queryKey: growKeys.detail(id!),
    queryFn: () => getGrow(id!),
    enabled: !!id,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for creating a new grow
 * Invalidates all grow lists on success
 *
 * @returns Mutation function and state
 */
export const useCreateGrow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGrowRequest) => createGrow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: growKeys.lists() });
    },
  });
};

/**
 * Hook for updating an existing grow
 * Invalidates both the specific grow and all lists on success
 *
 * @returns Mutation function and state
 */
export const useUpdateGrow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGrowRequest }) =>
      updateGrow(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growKeys.lists() });
      queryClient.invalidateQueries({ queryKey: growKeys.detail(variables.id) });
    },
  });
};

/**
 * Hook for deleting a grow
 * Invalidates all grow lists on success
 *
 * @returns Mutation function and state
 */
export const useDeleteGrow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteGrow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: growKeys.lists() });
    },
  });
};

/**
 * Hook for updating a grow's cultivation phase
 * Invalidates both the specific grow and all lists on success
 * Use this when transitioning between phases (germination -> vegetative -> flowering -> harvest)
 *
 * @returns Mutation function and state
 */
export const useUpdateGrowPhase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePhaseRequest }) =>
      updateGrowPhase(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growKeys.lists() });
      queryClient.invalidateQueries({ queryKey: growKeys.detail(variables.id) });
    },
  });
};
