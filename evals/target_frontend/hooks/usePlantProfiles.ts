"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchPlantProfiles,
  fetchPlantProfile,
  fetchPlantProfileTips,
} from "../api/plantProfileApi";
import type {
  PlantProfileFilters,
  PlantProfilesResponse,
  PlantProfile,
  PlantProfileTip,
} from "../types";

export const usePlantProfiles = (filters?: PlantProfileFilters) => {
  return useQuery<PlantProfilesResponse, Error>({
    queryKey: ["plantProfiles", filters],
    queryFn: () => fetchPlantProfiles(filters),
  });
};

export const usePlantProfile = (id: string) => {
  return useQuery<PlantProfile, Error>({
    queryKey: ["plantProfile", id],
    queryFn: () => fetchPlantProfile(id),
    enabled: !!id,
  });
};

export const usePlantProfileTips = (id: string, zone?: number) => {
  return useQuery<PlantProfileTip[], Error>({
    queryKey: ["plantProfileTips", id, zone],
    queryFn: () => fetchPlantProfileTips(id, zone),
    enabled: !!id,
  });
};
