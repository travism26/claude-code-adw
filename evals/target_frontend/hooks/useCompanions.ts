"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCompanions, fetchAllCompanions } from "../api/companionApi";
import type { CompanionRelationship, CompanionData } from "../types";

// Hook for fetching companions for a specific plant profile
export const useCompanions = (plantProfileId: string | null) => {
  return useQuery<CompanionRelationship[], Error>({
    queryKey: ["companions", plantProfileId],
    queryFn: () => fetchCompanions(plantProfileId!),
    enabled: !!plantProfileId,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
};

// Hook for fetching all companion relationships (for caching)
export const useAllCompanions = () => {
  return useQuery<CompanionRelationship[], Error>({
    queryKey: ["companions"],
    queryFn: fetchAllCompanions,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
};

// Helper hook to get structured companion data
export const useCompanionData = (plantProfileId: string | null) => {
  const { data: companions, ...rest } = useCompanions(plantProfileId);

  const companionData: CompanionData | null = companions
    ? {
        plantProfileId: plantProfileId!,
        beneficial: companions.filter((c) => c.relationship === "beneficial"),
        harmful: companions.filter((c) => c.relationship === "harmful"),
        neutral: companions.filter((c) => c.relationship === "neutral"),
      }
    : null;

  return {
    ...rest,
    data: companionData,
  };
};
