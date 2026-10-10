"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  logCareAction,
  fetchCareHistory,
  deleteCareHistoryEntry,
} from "../api/careHistoryApi";
import type {
  CareHistoryResponse,
  CareHistoryFilters,
  CareHistoryEntry,
} from "../types";

export const useCareHistory = (plantId?: string, filters?: CareHistoryFilters) => {
  const queryKey = plantId
    ? ["careHistory", plantId]
    : ["careHistory", "all", filters];

  return useQuery<CareHistoryResponse, Error>({
    queryKey,
    queryFn: () => fetchCareHistory(plantId, filters),
  });
};

export const useLogCareAction = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CareHistoryEntry,
    Error,
    {
      plantId: string;
      actionType: string;
      notes?: string;
      actionDate?: Date;
    }
  >({
    mutationFn: ({ plantId, actionType, notes, actionDate }) =>
      logCareAction(plantId, actionType, notes, actionDate),
    onSuccess: (data) => {
      // Invalidate care history queries for this plant and all plants
      queryClient.invalidateQueries({ queryKey: ["careHistory", data.plant_id] });
      queryClient.invalidateQueries({ queryKey: ["careHistory", "all"] });

      // Also invalidate plant queries as care actions may affect plant status
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      queryClient.invalidateQueries({ queryKey: ["plant", data.plant_id] });
    },
  });
};

export const useDeleteCareHistory = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteCareHistoryEntry(id),
    onSuccess: () => {
      // Invalidate all care history queries
      queryClient.invalidateQueries({ queryKey: ["careHistory"] });
      queryClient.invalidateQueries({ queryKey: ["plants"] });
    },
  });
};
