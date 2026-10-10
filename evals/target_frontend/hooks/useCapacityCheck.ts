"use client";

/**
 * Capacity Check React Query Hook
 *
 * Custom hook for checking environment capacity with debouncing.
 * Uses TanStack Query for caching and automatic refetching.
 * Implements debouncing to prevent excessive API calls during form input.
 */

import { useQuery } from "@tanstack/react-query";
import { checkCapacity, getEnvironmentCapacity } from "../api/growEnvironmentApi";
import type { CapacityCheckResult, EnvironmentCapacityInfo } from "../types/growEnvironment";
import { useEffect, useState } from "react";

/**
 * Hierarchical query key factory for capacity checks
 * Enables precise cache invalidation at different levels
 */
export const capacityKeys = {
  all: ["capacity"] as const,
  checks: () => [...capacityKeys.all, "check"] as const,
  check: (envId: string, plants: number) => [...capacityKeys.checks(), envId, plants] as const,
  current: () => [...capacityKeys.all, "current"] as const,
  currentEnv: (envId: string) => [...capacityKeys.current(), envId] as const,
};

/**
 * Hook for checking projected capacity with debouncing
 *
 * This hook calculates what the capacity status would be if the user adds
 * a specified number of plants to an environment. It implements a 500ms
 * debounce to prevent excessive API calls during form input.
 *
 * The query is only enabled when both environmentId and additionalPlants > 0.
 * Results are cached for 5 minutes to reduce API load.
 *
 * IMPORTANT: Capacity warnings are non-blocking - the `allowed` field in
 * the result is always `true`. Warnings are informational only.
 *
 * @param environmentId - UUID of the environment to check (null to disable)
 * @param additionalPlants - Number of plants to add for projection
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 * @returns Query result with projected capacity metrics
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCapacityCheck(envId, plantCount);
 * if (data?.status === 'warning') {
 *   return <CapacityWarning warnings={data.warnings} />;
 * }
 * ```
 */
export const useCapacityCheck = (
  environmentId: string | null,
  additionalPlants: number,
  debounceMs: number = 500
) => {
  // Debounce the additionalPlants value to prevent excessive API calls
  const [debouncedPlants, setDebouncedPlants] = useState(additionalPlants);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPlants(additionalPlants);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [additionalPlants, debounceMs]);

  return useQuery<CapacityCheckResult, Error>({
    queryKey: capacityKeys.check(environmentId!, debouncedPlants),
    queryFn: () => checkCapacity(environmentId!, debouncedPlants),
    enabled: !!environmentId && debouncedPlants > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    retry: false, // Don't retry failed capacity checks
  });
};

/**
 * Hook for fetching current capacity status of an environment
 *
 * Fetches the current capacity information without projection. This is
 * useful for displaying environment capacity in lists, cards, and selectors.
 *
 * @param environmentId - UUID of the environment (null to disable)
 * @returns Query result with current capacity information
 *
 * @example
 * ```tsx
 * const { data: capacity } = useEnvironmentCapacity(envId);
 * return (
 *   <div>
 *     {capacity?.currentPlants}/{capacity?.maxPlants} plants
 *     <CapacityStatusIndicator status={capacity?.capacityStatus} />
 *   </div>
 * );
 * ```
 */
export const useEnvironmentCapacity = (environmentId: string | null) => {
  return useQuery<EnvironmentCapacityInfo, Error>({
    queryKey: capacityKeys.currentEnv(environmentId!),
    queryFn: () => getEnvironmentCapacity(environmentId!),
    enabled: !!environmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    retry: false,
  });
};
