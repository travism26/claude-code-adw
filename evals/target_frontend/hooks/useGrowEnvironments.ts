"use client";

/**
 * Grow Environment React Query Hooks
 *
 * Custom hooks for grow environment CRUD operations using TanStack Query.
 * Implements hierarchical query key pattern and cache invalidation.
 * Components should use these hooks, never import API functions directly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGrowEnvironments,
  getGrowEnvironment,
  createGrowEnvironment,
  updateGrowEnvironment,
  deleteGrowEnvironment,
  getEnvironmentGrows,
} from "../api/growEnvironmentApi";
import type {
  GrowEnvironment,
  CreateGrowEnvironmentRequest,
  UpdateGrowEnvironmentRequest,
  GrowEnvironmentFilters,
  GrowEnvironmentsResponse,
} from "../types/growEnvironment";
import type { Grow } from "../types/grow";

/**
 * Hierarchical query key factory for grow environments
 * Enables precise cache invalidation at different levels
 */
export const growEnvironmentKeys = {
  all: ["growEnvironments"] as const,
  lists: () => [...growEnvironmentKeys.all, "list"] as const,
  list: (filters?: GrowEnvironmentFilters) => [...growEnvironmentKeys.lists(), filters] as const,
  details: () => [...growEnvironmentKeys.all, "detail"] as const,
  detail: (id: string) => [...growEnvironmentKeys.details(), id] as const,
  grows: (id: string) => [...growEnvironmentKeys.detail(id), "grows"] as const,
};

/**
 * Hook for fetching all grow environments with optional filters
 * Supports filtering by type, active status, and pagination
 *
 * @param filters - Optional filters for type, is_active, name, limit, offset
 * @returns Query result with environments array and metadata
 */
export const useGrowEnvironments = (filters?: GrowEnvironmentFilters) => {
  return useQuery<GrowEnvironmentsResponse, Error>({
    queryKey: growEnvironmentKeys.list(filters),
    queryFn: () => getGrowEnvironments(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for fetching a single grow environment by ID
 *
 * @param id - GrowEnvironment UUID (null to disable query)
 * @returns Query result with environment object
 */
export const useGrowEnvironment = (id: string | null) => {
  return useQuery<GrowEnvironment, Error>({
    queryKey: growEnvironmentKeys.detail(id!),
    queryFn: () => getGrowEnvironment(id!),
    enabled: !!id,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for fetching grows assigned to an environment
 *
 * @param id - GrowEnvironment UUID (null to disable query)
 * @returns Query result with array of grows
 */
export const useEnvironmentGrows = (id: string | null) => {
  return useQuery<Grow[], Error>({
    queryKey: growEnvironmentKeys.grows(id!),
    queryFn: () => getEnvironmentGrows(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for creating a new grow environment
 * Invalidates all environment lists on success
 *
 * @returns Mutation function and state
 */
export const useCreateGrowEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGrowEnvironmentRequest) => createGrowEnvironment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: growEnvironmentKeys.lists() });
    },
  });
};

/**
 * Hook for updating an existing grow environment
 * Invalidates both the specific environment and all lists on success
 *
 * @returns Mutation function and state
 */
export const useUpdateGrowEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGrowEnvironmentRequest }) =>
      updateGrowEnvironment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: growEnvironmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: growEnvironmentKeys.detail(variables.id) });
    },
  });
};

/**
 * Hook for deleting a grow environment
 * Invalidates all environment lists on success
 *
 * @returns Mutation function and state
 */
export const useDeleteGrowEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteGrowEnvironment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: growEnvironmentKeys.lists() });
    },
  });
};
