"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  detectZoneFromPostalCode,
  fetchUserZone,
  updateUserZone,
} from "../api/zoneApi";
import type { ZoneDetectionResult, UserZone } from "../types";

export const useUserZone = () => {
  return useQuery<UserZone, Error>({
    queryKey: ["userZone"],
    queryFn: fetchUserZone,
    // User zone data changes infrequently, so we can cache it aggressively
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useDetectZone = () => {
  const queryClient = useQueryClient();

  return useMutation<ZoneDetectionResult, Error, string>({
    mutationFn: (postalCode: string) => detectZoneFromPostalCode(postalCode),
    onSuccess: () => {
      // Optionally invalidate user zone if detection was successful
      queryClient.invalidateQueries({ queryKey: ["userZone"] });
    },
  });
};

export const useUpdateZone = () => {
  const queryClient = useQueryClient();

  return useMutation<
    UserZone,
    Error,
    { zone: number; postalCode?: string; override?: boolean }
  >({
    mutationFn: ({ zone, postalCode, override }) =>
      updateUserZone(zone, postalCode, override),
    onSuccess: () => {
      // Invalidate user-related queries after zone update
      queryClient.invalidateQueries({ queryKey: ["userZone"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["seasonalTips"] });
    },
  });
};
