"use client";

/**
 * Nutrient React Query Hooks
 *
 * Custom hooks for nutrient catalog and grow-nutrient operations using TanStack Query.
 * Implements hierarchical query key pattern and cache invalidation.
 * Components should use these hooks, never import API functions directly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNutrients,
  getGrowNutrients,
  addGrowNutrient,
  updateGrowNutrient,
  removeGrowNutrient,
} from "../api/nutrientApi";
import type {
  NutrientFilters,
  CreateGrowNutrientRequest,
  UpdateGrowNutrientRequest,
  NutrientsResponse,
  GrowNutrientsResponse,
} from "../types";

/**
 * Hierarchical query key factory for nutrients
 * Enables precise cache invalidation at different levels
 */
export const nutrientKeys = {
  all: ["nutrients"] as const,
  lists: () => [...nutrientKeys.all, "list"] as const,
  list: (filters?: NutrientFilters) => [...nutrientKeys.lists(), filters] as const,
  growNutrients: () => [...nutrientKeys.all, "growNutrients"] as const,
  growNutrient: (growId: string) => [...nutrientKeys.growNutrients(), growId] as const,
};

/**
 * Hook for fetching all nutrients (system + user's custom nutrients)
 * Supports filtering by brand, type, and organic status
 *
 * @param filters - Optional filters for brand, type, is_organic, pagination
 * @returns Query result with nutrients array
 */
export const useNutrients = (filters?: NutrientFilters) => {
  return useQuery<NutrientsResponse, Error>({
    queryKey: nutrientKeys.list(filters || {}),
    queryFn: () => getNutrients(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes - nutrient catalog changes infrequently
  });
};

/**
 * Hook for fetching nutrients assigned to a specific grow
 *
 * @param growId - Grow UUID (null to disable query)
 * @returns Query result with grow_nutrients array
 */
export const useGrowNutrients = (growId: string | null) => {
  return useQuery<GrowNutrientsResponse, Error>({
    queryKey: nutrientKeys.growNutrient(growId!),
    queryFn: () => getGrowNutrients(growId!),
    enabled: !!growId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for adding a nutrient to a grow
 * Invalidates both grow nutrients cache and grows list on success
 *
 * @returns Mutation function and state
 */
export const useAddGrowNutrient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ growId, data }: { growId: string; data: CreateGrowNutrientRequest }) =>
      addGrowNutrient(growId, data),
    onSuccess: (_, variables) => {
      // Invalidate grow nutrients for this specific grow
      queryClient.invalidateQueries({ queryKey: nutrientKeys.growNutrient(variables.growId) });
      // Invalidate grows list as grow might display nutrient count
      queryClient.invalidateQueries({ queryKey: ["grows"] });
    },
  });
};

/**
 * Hook for updating a grow-nutrient relationship
 * Updates dosage, frequency, or phase configuration
 *
 * @returns Mutation function and state
 */
export const useUpdateGrowNutrient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGrowNutrientRequest }) =>
      updateGrowNutrient(id, data),
    onSuccess: () => {
      // Invalidate all grow nutrients queries
      queryClient.invalidateQueries({ queryKey: nutrientKeys.growNutrients() });
    },
  });
};

/**
 * Hook for removing a nutrient from a grow
 * Invalidates grow nutrients cache on success
 *
 * @returns Mutation function and state
 */
export const useRemoveGrowNutrient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeGrowNutrient(id),
    onSuccess: () => {
      // Invalidate all grow nutrients queries
      queryClient.invalidateQueries({ queryKey: nutrientKeys.growNutrients() });
      // Invalidate grows list as grow might display nutrient count
      queryClient.invalidateQueries({ queryKey: ["grows"] });
    },
  });
};
