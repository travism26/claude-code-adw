"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getEnvironmentOverview,
  getEnvironmentCapacity,
} from "../api/environmentOverviewApi";
import type { EnvironmentOverview, EnvironmentWithCapacity } from "../types";

/**
 * Query key factory for environment overview
 * Provides hierarchical query keys for better cache management
 */
export const environmentOverviewKeys = {
  all: ["environmentOverview"] as const,
  overview: () => [...environmentOverviewKeys.all, "overview"] as const,
  capacity: (id: string) => [...environmentOverviewKeys.all, "capacity", id] as const,
};

/**
 * Hook for fetching environment overview with capacity data
 * Auto-refreshes every 30 seconds and on window focus
 */
export const useEnvironmentOverview = () => {
  return useQuery<EnvironmentOverview, Error>({
    queryKey: environmentOverviewKeys.overview(),
    queryFn: getEnvironmentOverview,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for fetching capacity data for a single environment
 * @param id - Environment ID
 */
export const useEnvironmentCapacity = (id: string | null) => {
  return useQuery<EnvironmentWithCapacity, Error>({
    queryKey: environmentOverviewKeys.capacity(id!),
    queryFn: () => getEnvironmentCapacity(id!),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
};
