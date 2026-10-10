"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchHarvest, createHarvest, updateHarvest } from "../api/growHarvestApi";
import type { HarvestInput, HarvestResponse } from "../types/growHarvest";

export const harvestKeys = {
  grow: (growId: string) => ["growHarvest", growId] as const,
};

export const useGrowHarvest = (growId: string | null) =>
  useQuery<HarvestResponse, Error>({
    queryKey: harvestKeys.grow(growId!),
    queryFn: () => fetchHarvest(growId!),
    enabled: !!growId,
  });

/** Upsert: create when no harvest exists yet, otherwise update. */
export const useSaveHarvest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      growId,
      data,
      isUpdate,
    }: {
      growId: string;
      data: HarvestInput;
      isUpdate: boolean;
    }) => (isUpdate ? updateHarvest(growId, data) : createHarvest(growId, data)),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: harvestKeys.grow(v.growId) });
      // grow.harvested_at changes → refresh grow list/detail.
      qc.invalidateQueries({ queryKey: ["grows"] });
    },
  });
};
